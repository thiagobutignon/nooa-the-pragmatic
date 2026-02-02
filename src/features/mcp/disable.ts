import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";

export async function disableCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp disable <name>

Arguments:
  name          Name of the MCP server to disable

Options:
  -h, --help     Show this help message`);
		return 0;
	}

	if (positionals.length === 0) {
		console.error("Error: MCP name required");
		return 2;
	}

	const name = positionals[0];

	// TODO: Use actual database path
	const db = new Database(":memory:");
	const registry = new Registry(db);

	const mcp = await registry.get(name);
	if (!mcp) {
		console.error(`Error: MCP "${name}" not found`);
		return 1;
	}

	await registry.disable(name);
	console.log(`✅ Disabled MCP: ${name}`);

	return 0;
}
