import type { Command, CommandContext } from "../../core/command";
import { runSearch } from "./engine";

const searchHelp = `
Usage: nooa search <query> [path] [flags]

Arguments:
  <query>            Search term or regex.
  [path]             Root directory (default: .)

Flags:
  --regex            Treat query as regex.
  --case-sensitive   Disable case-insensitive search.
  --files-only       List matching files only.
  --max-results <n>  Limit results (default: 100).
  --include <glob>   Include glob (repeatable).
  --exclude <glob>   Exclude glob (repeatable).
  --json             Output structured JSON.
  --plain            Output stable line format.
  --no-color         Disable color output.
  --context <n>      Show n lines of context (default: 0).
  --ignore-case, -i  Enable case-insensitive search.
  --count, -c        Show only count of matches per file.
  --hidden           Include hidden files.
  -h, --help         Show help.
`;

function normalizeList(value: unknown): string[] | undefined {
	if (!value) return undefined;
	if (Array.isArray(value)) return value.map(String);
	return [String(value)];
}

const searchCommand: Command = {
	name: "search",
	description: "Search files and file contents",
	execute: async ({ args, values }: CommandContext) => {
		if (values.help) {
			console.log(searchHelp);
			return;
		}

		const query = args[1];
		const root = args[2] ?? ".";
		if (!query) {
			console.error("Error: Query is required.");
			process.exitCode = 2;
			return;
		}

		const maxResultsEnv = process.env.NOOA_SEARCH_MAX_RESULTS;
		const maxResults = Number(values["max-results"] ?? maxResultsEnv ?? 100);

		const results = await runSearch({
			query,
			root,
			regex: Boolean(values.regex),
			maxResults: Number.isNaN(maxResults) ? 100 : maxResults,
			include: normalizeList(values.include),
			exclude: normalizeList(values.exclude),
			filesOnly: Boolean(values["files-only"]),
			ignoreCase: Boolean(values["ignore-case"]),
			caseSensitive: Boolean(values["case-sensitive"]),
			context: Number(values.context ?? 0) || 0,
			count: Boolean(values.count),
			hidden: Boolean(values.hidden),
		});

		if (values["files-only"]) {
			const files = Array.from(new Set(results.map((r) => r.path)));
			process.stdout.write(`${files.join("\n")}${files.length ? "\n" : ""}`);
			console.error(`Found ${files.length} files`);
			return;
		}

		if (values.count) {
			const lines = results.map(
				(r) => `${r.path}:${r.matchCount ?? 0}`,
			);
			process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
			console.error(`Found ${lines.length} files with matches`);
			return;
		}

		if (values.json) {
			process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
			console.error(`Found ${results.length} matches`);
			return;
		}

		if (values.plain) {
			const lines = results.map(
				(r) => `${r.path}:${r.line}:${r.column}:${r.snippet}`,
			);
			process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
			console.error(`Found ${results.length} matches`);
			return;
		}

		const lines = results.map(
			(r) => `${r.path}:${r.line}:${r.column}:${r.snippet}`,
		);
		process.stdout.write(`${lines.join("\n")}${lines.length ? "\n" : ""}`);
		console.error(`Found ${results.length} matches`);
	},
};

export default searchCommand;
