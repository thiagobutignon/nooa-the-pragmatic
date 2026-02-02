import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";
import { openMcpDatabase } from "../../core/mcp/db";

export async function infoCommand(rawArgs: string[]): Promise<number> {
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
		console.log(`Usage: nooa mcp info <name> [flags]

Arguments:
  name          MCP name (required)

Flags:
  --json        Output structured data
  -h, --help    Show this help message
`);
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

		if (values.json) {
			console.log(JSON.stringify(server, null, 2));
		} else {
			console.log(`Name: ${server.name}`);
			console.log(`Package: ${server.package}`);
			console.log(`Command: ${server.command} ${server.args.join(" ")}`);
			console.log(`Enabled: ${server.enabled ? "yes" : "no"}`);
			if (server.env) {
				for (const [key, value] of Object.entries(server.env)) {
					console.log(`  ${key}=${value}`);
				}
			}
		}
		return 0;
	} finally {
		db.close();
	}
}
