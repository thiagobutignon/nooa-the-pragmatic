import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";

export async function healthCommand(rawArgs: string[]): Promise<number> {
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
		console.log(`Usage: nooa mcp health <name> [flags]

Arguments:
  name           MCP server name

Flags:
  --json         Output machine-readable JSON
  -h, --help     Show this help message`);
		return 0;
	}

	const name = positionals[0];
	if (!name) {
		console.error("Error: MCP name required");
		return 2;
	}

	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const status = await registry.healthCheck(name);
		if (values.json) {
			console.log(JSON.stringify(status, null, 2));
			return status.status === "healthy" ? 0 : 1;
		}

		const parts = [
			`MCP ${name}`,
			`status=${status.status}`,
			healthyText(status),
		];
		console.log(parts.filter(Boolean).join(" | "));
		return status.status === "healthy" ? 0 : 1;
	} catch (error) {
		console.error(`Error checking MCP health: ${(error as Error).message}`);
		return 1;
	} finally {
		db.close();
	}
}

function healthyText(status: unknown): string | undefined {
	if (!status || typeof status !== "object") return undefined;
	const { latency, lastError } = status as {
		latency?: number;
		lastError?: string;
	};
	if (lastError) return `error=${lastError}`;
	if (typeof latency === "number" && latency >= 0)
		return `latency=${latency}ms`;
	return undefined;
}
