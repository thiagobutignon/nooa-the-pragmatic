import type { Command, CommandContext } from "../../core/command";

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

const searchCommand: Command = {
	name: "search",
	description: "Search files and file contents",
	execute: async ({ args, values }: CommandContext) => {
		if (values.help) {
			console.log(searchHelp);
			return;
		}

		const query = args[1];
		if (!query) {
			console.error("Error: Query is required.");
			process.exitCode = 2;
			return;
		}

		console.error("Error: Search engine not implemented.");
		process.exitCode = 1;
	},
};

export default searchCommand;
