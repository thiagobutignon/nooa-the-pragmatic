import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";

import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { hasRipgrep, runSearch, type SearchResult } from "./engine";

export const searchMeta: AgentDocMeta = {
	name: "search",
	description: "Search files and file contents",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const searchHelp = `
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

export const searchSdkUsage = `
SDK Usage:
  const result = await search.run({ query: "TODO", root: ".", json: true });
  if (result.ok) console.log(result.data.results);
`;

export const searchUsage = {
	cli: "nooa search <query> [path] [flags]",
	sdk: 'await search.run({ query: "TODO", root: "." })',
	tui: "SearchPanel()",
};

export const searchSchema = {
	query: { type: "string", required: true },
	root: { type: "string", required: false },
	regex: { type: "boolean", required: false },
	"case-sensitive": { type: "boolean", required: false },
	"files-only": { type: "boolean", required: false },
	"max-results": { type: "string", required: false },
	include: { type: "string", required: false },
	exclude: { type: "string", required: false },
	plain: { type: "boolean", required: false },
	"no-color": { type: "boolean", required: false },
	context: { type: "string", required: false },
	"ignore-case": { type: "boolean", required: false },
	count: { type: "boolean", required: false },
	hidden: { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const searchOutputFields = [
	{ name: "results", type: "string" },
	{ name: "engine", type: "string" },
	{ name: "root", type: "string" },
	{ name: "query", type: "string" },
];

export const searchErrors = [
	{ code: "search.missing_query", message: "Query is required." },
	{ code: "search.invalid_max_results", message: "Invalid max-results." },
	{ code: "search.runtime_error", message: "Search failed." },
];

export const searchExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const searchExamples = [
	{
		input: 'nooa search "TODO" . --include "*.ts"',
		output:
			"Search for 'TODO' in all TypeScript files in the current directory.",
	},
	{
		input: 'nooa search "class User" src --json',
		output:
			"Find all occurrences of 'class User' in 'src/' and output as JSON.",
	},
];

function normalizeList(value: unknown): string[] | undefined {
	if (!value) return undefined;
	if (Array.isArray(value)) return value.map(String);
	return [String(value)];
}

function resolveEngineName(forced?: string, detected?: boolean) {
	if (forced === "rg" || forced === "native") return forced;
	return detected ? "rg" : "native";
}

export interface SearchRunInput {
	query?: string;
	root?: string;
	regex?: boolean;
	"case-sensitive"?: boolean;
	"files-only"?: boolean;
	"max-results"?: string;
	include?: string[];
	exclude?: string[];
	plain?: boolean;
	"no-color"?: boolean;
	context?: string;
	"ignore-case"?: boolean;
	count?: boolean;
	hidden?: boolean;
	json?: boolean;
}

export interface SearchRunResult {
	results: SearchResult[];
	query: string;
	root: string;
	engine: string;
	max_results: number;
}

export async function run(
	input: SearchRunInput,
): Promise<SdkResult<SearchRunResult>> {
	const query = input.query;
	if (!query) {
		return {
			ok: false,
			error: sdkError("search.missing_query", "Query is required."),
		};
	}

	const root = input.root ?? ".";
	const maxResultsStr =
		input["max-results"] ?? process.env.NOOA_SEARCH_MAX_RESULTS ?? "100";
	const maxResults = parseInt(maxResultsStr, 10);
	if (Number.isNaN(maxResults)) {
		return {
			ok: false,
			error: sdkError(
				"search.invalid_max_results",
				`Invalid max-results '${maxResultsStr}'.`,
			),
		};
	}

	const ignoreCase = Boolean(input["ignore-case"]);
	const caseSensitive = Boolean(input["case-sensitive"]);
	const forced = process.env.NOOA_SEARCH_ENGINE?.toLowerCase();
	const detected = await hasRipgrep();
	const engineUsed = resolveEngineName(forced, detected);

	try {
		const results = await runSearch({
			query,
			root,
			regex: Boolean(input.regex),
			maxResults,
			include: normalizeList(input.include),
			exclude: normalizeList(input.exclude),
			filesOnly: Boolean(input["files-only"]),
			ignoreCase,
			caseSensitive,
			context: Number(input.context ?? 0) || 0,
			count: Boolean(input.count),
			hidden: Boolean(input.hidden),
		});

		return {
			ok: true,
			data: {
				results,
				query,
				root,
				engine: engineUsed,
				max_results: Number.isNaN(maxResults) ? 100 : maxResults,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("search.runtime_error", message),
		};
	}
}

const searchBuilder = new CommandBuilder<SearchRunInput, SearchRunResult>()
	.meta(searchMeta)
	.usage(searchUsage)
	.schema(searchSchema)
	.help(searchHelp)
	.sdkUsage(searchSdkUsage)
	.outputFields(searchOutputFields)
	.examples(searchExamples)
	.errors(searchErrors)
	.exitCodes(searchExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
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
	})
	.parseInput(async ({ values, positionals }) => ({
		query: positionals[1],
		root: positionals[2] ?? ".",
		regex: Boolean(values.regex),
		"case-sensitive": Boolean(values["case-sensitive"]),
		"files-only": Boolean(values["files-only"]),
		"max-results": values["max-results"] as string | undefined,
		include: normalizeList(values.include),
		exclude: normalizeList(values.exclude),
		plain: Boolean(values.plain),
		"no-color": Boolean(values["no-color"]),
		context: values.context as string | undefined,
		"ignore-case": Boolean(values["ignore-case"]),
		count: Boolean(values.count),
		hidden: Boolean(values.hidden),
		json: Boolean(values.json),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values["files-only"]) {
			const files = Array.from(new Set(output.results.map((r) => r.path)));
			process.stdout.write(`${files.join("\n")}${files.length ? "\n" : ""}`);
			console.error(`Found ${files.length} files`);
			return;
		}

		if (values.count) {
			const lines = output.results.map((r) => `${r.path}:${r.matchCount ?? 0}`);
			process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
			console.error(`Found ${lines.length} files with matches`);
			return;
		}

		if (values.json) {
			renderJson(output.results);
			console.error(`Found ${output.results.length} matches`);
			return;
		}

		const lines = output.results.map(
			(r) => `${r.path}:${r.line}:${r.column}:${r.snippet}`,
		);
		process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
		console.error(`Found ${output.results.length} matches`);
	})
	.onFailure((error) => {
		handleCommandError(error, [
			"search.missing_query",
			"search.invalid_max_results",
		]);
	})
	.telemetry({
		eventPrefix: "search",
		successMetadata: (_, output) => ({
			result_count: output.results.length,
			engine: output.engine,
			query: output.query,
			root: output.root,
		}),
		failureMetadata: (input, error) => ({
			error: error.message,
			query: input.query,
			root: input.root,
		}),
	});

export const searchAgentDoc = searchBuilder.buildAgentDoc(false);
export const searchFeatureDoc = (includeChangelog: boolean) =>
	searchBuilder.buildFeatureDoc(includeChangelog);

export default searchBuilder.build();
