import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { buildContext } from "./execute";

const contextHelp = `
Usage: nooa context <file|symbol> [flags]

Generate context pack for AI consumption.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.
`;

const contextCommand: Command = {
	name: "context",
	description: "Generate AI context pack",
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
			console.log(contextHelp);
			return;
		}

		const target = positionals[1];
		if (!target) {
			console.error("Error: File or symbol required.");
			process.exitCode = 2;
			return;
		}

		try {
			const result = await buildContext(target);
			if (values.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				console.log(`Target: ${result.target}`);
				console.log(`Related: ${result.related.join(", ") || "none"}`);
				console.log(`Tests: ${result.tests.join(", ") || "none"}`);
				console.log(`Recent Commits: ${result.recentCommits.length}`);
			}
		} catch (e) {
			console.error(`Error building context: ${(e as Error).message}`);
			process.exitCode = 1;
		}
	},
};

export default contextCommand;
