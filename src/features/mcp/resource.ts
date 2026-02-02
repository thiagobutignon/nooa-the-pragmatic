import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";
import { ServerManager } from "../../core/mcp/ServerManager";

export async function resourceCommand(rawArgs: string[]): Promise<number> {
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
		console.log(`Usage: nooa mcp resource <name> <uri> [flags]

Arguments:
  name            MCP name
  uri             Resource URI to read

Flags:
  --json          Output as JSON
  -h, --help      Show this help message`);
		return 0;
	}

	const name = positionals[0];
	const uri = positionals[1];
	if (!name || !uri) {
		console.error("Error: MCP name and resource URI are required");
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

		const result = await client.readResource(uri);
		if (values.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(JSON.stringify(result));
		}

		return 0;
	} catch (error) {
		console.error(`Error loading resource: ${(error as Error).message}`);
		return 1;
	} finally {
		await serverManager.stopAll();
		db.close();
	}
}
