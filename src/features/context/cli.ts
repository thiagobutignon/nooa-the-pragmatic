import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import { logger } from "../../core/logger";
import { getMcpResourcesForContext } from "../../core/mcp/integrations/context";
import { buildContext } from "./execute";

const contextHelp = `
Usage: nooa context <file|symbol> [flags]

Generate context pack for AI consumption.

Flags:
  --json         Output results as JSON.
  --include-mcp  Include MCP resource metadata.
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
			const includeMcp = Boolean(values["include-mcp"]);
			let mcpResources;
			if (includeMcp) {
				const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
				const db = new Database(dbPath);
				try {
					mcpResources = await getMcpResourcesForContext(db);
				} finally {
					db.close();
				}
			}
			if (values.json) {
				const output = { ok: true, ...result, timestamp: Date.now() };
				if (mcpResources) {
					output.mcpResources = mcpResources;
				}
				console.log(JSON.stringify(output, null, 2));
			} else {
				console.log(`Target: ${result.target}`);
				console.log(`Related: ${result.related.join(", ") || "none"}`);
				console.log(`Tests: ${result.tests.join(", ") || "none"}`);
				console.log(`Symbols: ${result.symbols.join(", ") || "none"}`);
				console.log(`Recent Commits: ${result.recentCommits.length}`);
				if (mcpResources) {
					console.log(
						`MCP Resources: ${
							mcpResources.map((r) => r.name).join(", ") || "none"
						}`,
					);
				}
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
