import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";
import { openMcpDatabase } from "../../core/mcp/db";

export async function enableCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp enable <name>

Arguments:
  name          Name of the MCP server to enable

Options:
  -h, --help     Show this help message`);
		return 0;
	}

	if (positionals.length === 0) {
		console.error("Error: MCP name required");
		return 2;
	}

	const name = positionals[0];

	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const mcp = await registry.get(name);
		if (!mcp) {
			console.error(`Error: MCP "${name}" not found`);
			return 1;
		}

		await registry.enable(name);
		console.log(`✅ Enabled MCP: ${name}`);

		return 0;
	} finally {
		db.close();
	}
}
