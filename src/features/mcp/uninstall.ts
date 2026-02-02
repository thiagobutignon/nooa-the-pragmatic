import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";

export async function uninstallCommand(rawArgs: string[]): Promise<number> {
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
		console.log(`Usage: nooa mcp uninstall <name> [flags]

Arguments:
  name        MCP name to remove

Flags:
  --json      Output structured confirmation
  -h, --help  Show this help message`);
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
		const server = await registry.get(name);
		if (!server) {
			console.error(`Error: MCP "${name}" not found`);
			return 1;
		}

		await registry.remove(name);

		if (values.json) {
			console.log(JSON.stringify({ name, removed: true }, null, 2));
		} else {
			console.log(`🗑️  Removed MCP "${name}"`);
		}

		return 0;
	} finally {
		db.close();
	}
}
