import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import { logger } from "../../core/logger";
import { executeSearch } from "../index/execute";

const askHelp = `
Usage: nooa ask <query> [flags]

Search code and memory using semantic similarity.

Flags:
  --limit <n>    Limit result count (default: 5).
  --json         Output results as JSON.
  -h, --help     Show help message.
`;

const askCommand: Command = {
	name: "ask",
	description: "Query indexed code/memory",
	execute: async ({ rawArgs }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
				limit: { type: "string" },
			},
			allowPositionals: true,
			strict: false,
		});

		if (values.help) {
			console.log(askHelp);
			return;
		}

		const query = positionals.slice(1).join(" ");
		if (!query) {
			console.error("Error: Query required.");
			process.exitCode = 2;
			return;
		}

		try {
			const limitStr = (values.limit as string) ?? "5";
			const limit = parseInt(limitStr, 10);
			const results = await executeSearch(query, limit);

			if (values.json) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				console.log(`\n🔍 Results for: "${query}"\n`);
				for (const res of results) {
					console.log(`📄 ${res.path} (score: ${res.score.toFixed(4)})`);
					console.log(
						`   ${res.chunk.substring(0, 200).replace(/\n/g, " ")}...`,
					);
					console.log("");
				}
			}
		} catch (e) {
			logger.error("ask.error", e as Error);
			console.error(`Error: ${(e as Error).message}`);
			process.exitCode = 1;
		}
	},
};

export default askCommand;
