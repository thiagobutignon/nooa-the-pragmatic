import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";
import { ServerManager } from "../../core/mcp/ServerManager";

const reservedCallFlags = new Set([
	"json",
	"help",
	"retries",
	"timeout",
	"backoff",
]);

function parseNumber(value: string | undefined, fallback: number): number {
	const parsed = value ? Number(value) : NaN;
	return Number.isFinite(parsed) ? parsed : fallback;
}

export async function callCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			json: { type: "boolean" },
			retries: { type: "string" },
			timeout: { type: "string" },
			backoff: { type: "string" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp call <mcp-name> <tool-name> [--arg=value...]

Arguments:
  mcp-name      Name of the MCP server
  tool-name     Name of the tool to execute

Options:
  --json        Output as JSON
  -h, --help    Show this help message

Examples:
  nooa mcp call filesystem read_file --path=README.md
  nooa mcp call github create_issue --title="Bug" --body="Description"`);
		return 0;
	}

	const mcpName = positionals[0];
	const toolName = positionals[1];

	if (!mcpName || !toolName) {
		console.error("Error: MCP name and tool name required");
		return 2;
	}

	const toolArgs: Record<string, unknown> = {};
	for (const arg of rawArgs) {
		if (arg.startsWith("--") && arg.includes("=")) {
			const parts = arg.slice(2).split("=");
			const key = parts[0];
			const value = parts.slice(1).join("=");
			if (key && !reservedCallFlags.has(key)) {
				toolArgs[key] = value;
			}
		}
	}

	const db = openMcpDatabase();
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	try {
		const mcp = await registry.get(mcpName);
		if (!mcp) {
			console.error(`Error: MCP "${mcpName}" not found`);
			return 1;
		}

		let client = serverManager.getClient(mcpName);
		if (!client || !client.isRunning()) {
			client = await serverManager.start(mcp);
		}

		const callOptions = {
			retries: parseNumber(values.retries, 3),
			timeout: parseNumber(values.timeout, 30000),
			backoff: parseNumber(values.backoff, 500),
		};
		const result = await client.callTool(toolName, toolArgs, callOptions);

		if (values.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(result);
		}

		return 0;
	} catch (error) {
		console.error(`Error executing tool: ${(error as Error).message}`);
		return 1;
	} finally {
		await serverManager.stopAll();
		db.close();
	}
}
