import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { hasRipgrep, runSearch } from "./engine";

const searchHelp = `
Usage: nooa search <query> [path] [flags]

Search for patterns in file contents or filenames.

Arguments:
  <query>            Search term or regex pattern.
  [path]             Directory to search in (default: .).

Flags:
  --regex            Treat query as a regular expression.
  --case-sensitive   Enable case-sensitive matching.
  --files-only       Only list matching file paths.
  --max-results <n>  Limit total matches (default: 100).
  --include <glob>   Include files matching glob (repeatable).
  --exclude <glob>   Include files matching glob (repeatable).
  --json             Output detailed results as JSON.
  --plain            Output results in a stable, parseable format.
  --no-color         Disable terminal colors in output.
  --context <n>      Show n lines of context (default: 0).
  --ignore-case, -i  Enable case-insensitive matching.
  --count, -c        Show only the count of matches per file.
  --hidden           Include hidden files and directories.
  -h, --help         Show help message.

Examples:
  nooa search "TODO" . --include "*.ts"
  nooa search "class User" src --json
  nooa search "error" logs --context 2 --regex

Exit Codes:
  0: Success (matches found)
  1: Runtime Error (failed execution)
  2: Validation Error (missing query)
`;

function normalizeList(value: unknown): string[] | undefined {
	if (!value) return undefined;
	if (Array.isArray(value)) return value.map(String);
	return [String(value)];
}

function resolveEngineName(forced?: string, detected?: boolean) {
	if (forced === "rg" || forced === "native") return forced;
	return detected ? "rg" : "native";
}

const searchCommand: Command = {
	name: "search",
	description: "Search files and file contents",
	options: {
		regex: { type: "boolean" },
		"case-sensitive": { type: "boolean" },
		"files-only": { type: "boolean" },
		"max-results": { type: "string" },
		include: { type: "string", multiple: true },
		exclude: { type: "string", multiple: true },
		plain: { type: "boolean" },
		"no-color": { type: "boolean" },
		context: { type: "string" },
		"ignore-case": { type: "boolean", short: "i" },
		count: { type: "boolean", short: "c" },
		hidden: { type: "boolean" },
	},
	execute: async ({ rawArgs, values: globalValues, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				...searchCommand.options,
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		if (values.help) {
			console.log(searchHelp);
			return;
		}

		const query = positionals[1];
		const root = positionals[2] ?? ".";
		if (!query) {
			console.error("Error: Query is required.");
			process.exitCode = 2;
			return;
		}

		const traceId = createTraceId();
		logger.setContext({ trace_id: traceId, command: "search" });
		const startTime = Date.now();
		const maxResultsEnv = process.env.NOOA_SEARCH_MAX_RESULTS;
		const maxResults = Number(values["max-results"] ?? maxResultsEnv ?? 100);
		const ignoreCase = Boolean(values["ignore-case"]);
		const caseSensitive = Boolean(values["case-sensitive"]);
		const flagsMetadata = {
			regex: Boolean(values.regex),
			files_only: Boolean(values["files-only"]),
			max_results: Number.isNaN(maxResults) ? 100 : maxResults,
			include: normalizeList(values.include),
			exclude: normalizeList(values.exclude),
			ignore_case: ignoreCase,
			case_sensitive: caseSensitive,
			context: Number(values.context ?? 0) || 0,
			count: Boolean(values.count),
			hidden: Boolean(values.hidden),
			json: Boolean(values.json),
			plain: Boolean(values.plain),
		};

		telemetry.track(
			{
				event: "search.started",
				level: "info",
				success: true,
				trace_id: traceId,
				metadata: { query, root, flags: flagsMetadata },
			},
			bus,
		);
		logger.debug("search.started", { query, root, flags: flagsMetadata });

		try {
			const engineStart = Date.now();
			const forced = process.env.NOOA_SEARCH_ENGINE?.toLowerCase();
			const detected = await hasRipgrep();
			const engineUsed = resolveEngineName(forced, detected);
			const engineDetectMs = Date.now() - engineStart;

			const searchStart = Date.now();
			const results = await runSearch({
				query,
				root,
				regex: Boolean(values.regex),
				maxResults: Number.isNaN(maxResults) ? 100 : maxResults,
				include: normalizeList(values.include),
				exclude: normalizeList(values.exclude),
				filesOnly: Boolean(values["files-only"]),
				ignoreCase,
				caseSensitive,
				context: Number(values.context ?? 0) || 0,
				count: Boolean(values.count),
				hidden: Boolean(values.hidden),
			});
			const searchMs = Date.now() - searchStart;

			const formatStart = Date.now();
			if (values["files-only"]) {
				const files = Array.from(new Set(results.map((r) => r.path)));
				process.stdout.write(`${files.join("\n")}${files.length ? "\n" : ""}`);
				console.error(`Found ${files.length} files`);
			} else if (values.count) {
				const lines = results.map((r) => `${r.path}:${r.matchCount ?? 0}`);
				process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
				console.error(`Found ${lines.length} files with matches`);
			} else if (values.json) {
				process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
				console.error(`Found ${results.length} matches`);
			} else {
				const lines = results.map(
					(r) => `${r.path}:${r.line}:${r.column}:${r.snippet}`,
				);
				process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
				console.error(`Found ${results.length} matches`);
			}
			const formatMs = Date.now() - formatStart;

			telemetry.track(
				{
					event: "search.success",
					level: "info",
					success: true,
					duration_ms: Date.now() - startTime,
					trace_id: traceId,
					metadata: {
						result_count: results.length,
						engine: engineUsed,
						engine_detect_ms: engineDetectMs,
						search_ms: searchMs,
						format_ms: formatMs,
						query,
						root,
					},
				},
				bus,
			);
			logger.info("search.completed", {
				result_count: results.length,
				engine: engineUsed,
				engine_detect_ms: engineDetectMs,
				search_ms: searchMs,
				format_ms: formatMs,
			});
			bus?.emit("search.completed", {
				trace_id: traceId,
				result_count: results.length,
				duration_ms: Date.now() - startTime,
				engine: engineUsed,
			});
			logger.clearContext();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			telemetry.track(
				{
					event: "search.failure",
					level: "error",
					success: false,
					duration_ms: Date.now() - startTime,
					trace_id: traceId,
					metadata: { error: message, query, root },
				},
				bus,
			);
			logger.error("search.failed", error as Error, { query, root });
			bus?.emit("search.failed", { trace_id: traceId, error: message });
			logger.clearContext();
			console.error(`Error: ${message} (trace_id=${traceId})`);
			process.exitCode = 1;
		}
	},
};

export default searchCommand;
