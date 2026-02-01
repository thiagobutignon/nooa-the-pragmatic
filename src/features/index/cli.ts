import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { indexRepo } from "./execute";
import { logger } from "../../core/logger";

const indexHelp = `
Usage: nooa index [subcommand] [flags]

Semantic indexing for code and memory.

Subcommands:
  repo     Index all TypeScript and Markdown files in the repository.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa index repo
`;

const indexCommand: Command = {
	name: "index",
	description: "Semantic indexing operations",
	execute: async ({ rawArgs }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
			},
			allowPositionals: true,
			strict: false,
		});

		if (values.help) {
			console.log(indexHelp);
			return;
		}

		const sub = positionals[1];
		if (sub === "repo") {
			try {
				console.log("🔍 Indexing repository (TypeScript/Markdown)...");
				const result = await indexRepo();
				if (values.json) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(`✅ Indexing complete!`);
					console.log(`   Files: ${result.files}`);
					console.log(`   Chunks: ${result.totalChunks}`);
					console.log(`   Trace ID: ${result.traceId}`);
				}
			} catch (e) {
				logger.error("index.error", e as Error);
				process.exitCode = 1;
			}
		} else {
			console.log(indexHelp);
		}
	},
};

export default indexCommand;
