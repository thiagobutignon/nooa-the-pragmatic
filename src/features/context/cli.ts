import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import { logger } from "../../core/logger";
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
			const msg = "Error: File or symbol required.";
			if (values.json) {
				console.log(
					JSON.stringify({
						ok: false,
						error: msg,
						traceId: logger.getContext().trace_id,
						schemaVersion: "1.0.0",
						timestamp: Date.now(),
					}),
				);
			} else {
				console.error(msg);
			}
			process.exitCode = 2;
			return;
		}

		try {
			const result = await buildContext(target);
			if (values.json) {
				console.log(
					JSON.stringify(
						{ ok: true, ...result, timestamp: Date.now() },
						null,
						2,
					),
				);
			} else {
				console.log(`Target: ${result.target}`);
				console.log(`Related: ${result.related.join(", ") || "none"}`);
				console.log(`Tests: ${result.tests.join(", ") || "none"}`);
				console.log(`Symbols: ${result.symbols.join(", ") || "none"}`);
				console.log(`Recent Commits: ${result.recentCommits.length}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const msg = `Error building context: ${message}`;
			if (values.json) {
				console.log(
					JSON.stringify({
						ok: false,
						error: msg,
						traceId: logger.getContext().trace_id,
						schemaVersion: "1.0.0",
						timestamp: Date.now(),
					}),
				);
			} else {
				console.error(msg);
			}
			process.exitCode = 1;
		}
	},
};

export default contextCommand;
