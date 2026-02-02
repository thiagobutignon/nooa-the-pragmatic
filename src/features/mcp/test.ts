import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";
import { ServerManager } from "../../core/mcp/ServerManager";

export async function testCommand(rawArgs: string[]): Promise<number> {
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
		console.log(`Usage: nooa mcp test <name> [flags]

Arguments:
  name          MCP server name

Flags:
  --json        Output JSON verdict
  -h, --help    Show this help message`);
		return 0;
	}

	const name = positionals[0];
	if (!name) {
		console.error("Error: MCP name required");
		return 2;
	}

	const db = openMcpDatabase();
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	try {
		const server = await registry.get(name);
		if (!server) {
			console.error(`Error: MCP "${name}" not found`);
			return 1;
		}

		let client = serverManager.getClient(name);
		if (!client || !client.isRunning()) {
			client = await serverManager.start(server);
		}

		const success = await client.ping();
		if (values.json) {
			console.log(JSON.stringify({ name, ok: success }, null, 2));
		} else {
			console.log(`MCP ${name} responded: ${success ? "ok" : "failed"}`);
		}

		return success ? 0 : 1;
	} catch (error) {
		console.error(`Error testing MCP: ${(error as Error).message}`);
		return 1;
	} finally {
		await serverManager.stopAll();
		db.close();
	}
}
