import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";
import { ServerManager } from "../../core/mcp/ServerManager";

export async function callCommand(rawArgs: string[]): Promise<number> {
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

	// Parse tool arguments from remaining args
	// biome-ignore lint/suspicious/noExplicitAny: Tool arguments are dynamic JSON
	const toolArgs: Record<string, any> = {};
	for (const arg of rawArgs) {
		if (arg.startsWith("--") && arg.includes("=")) {
			const parts = arg.slice(2).split("=");
			const key = parts[0];
			const value = parts.slice(1).join("=");
			if (key && key !== "json" && key !== "help") {
				toolArgs[key] = value;
			}
		}
	}

	// TODO: Use actual database path
	const db = new Database(":memory:");
	const registry = new Registry(db);
	const serverManager = new ServerManager();

	const mcp = await registry.get(mcpName);
	if (!mcp) {
		console.error(`Error: MCP "${mcpName}" not found`);
		return 1;
	}

	try {
		let client = serverManager.getClient(mcpName);
		if (!client || !client.isRunning()) {
			client = await serverManager.start(mcp);
		}

		const result = await client.callTool(toolName, toolArgs);

		if (values.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(result);
		}

		await serverManager.stopAll();
		return 0;
	} catch (error) {
		console.error(`Error executing tool: ${(error as Error).message}`);
		await serverManager.stopAll();
		return 1;
	}
}
