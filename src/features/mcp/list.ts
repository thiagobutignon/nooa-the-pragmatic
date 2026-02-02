import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";

export async function listCommand(rawArgs: string[]): Promise<number> {
	const { values } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			installed: { type: "boolean" },
			enabled: { type: "boolean" },
			json: { type: "boolean" },
		},
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp list [options]

Options:
  --installed    List all installed MCPs
  --enabled      List only enabled MCPs (default)
  --json         Output as JSON
  -h, --help     Show this help message`);
		return 0;
	}

	// TODO: Use actual database path
	const db = new Database(":memory:");
	const registry = new Registry(db);

	let mcps: Awaited<ReturnType<typeof registry.listAll>>;
	if (values.installed) {
		mcps = await registry.listAll();
	} else {
		// Default to enabled
		mcps = await registry.listEnabled();
	}

	if (values.json) {
		console.log(JSON.stringify(mcps, null, 2));
	} else {
		if (mcps.length === 0) {
			console.log("No MCPs found");
		} else {
			console.log(`Found ${mcps.length} MCP(s):\n`);
			for (const mcp of mcps) {
				console.log(`  ${mcp.name}`);
				console.log(`    Status: ${mcp.enabled ? "enabled" : "disabled"}`);
				console.log(`    Command: ${mcp.command} ${mcp.args.join(" ")}`);
				if (mcp.package) {
					console.log(`    Package: ${mcp.package}`);
				}
				console.log();
			}
		}
	}

	return 0;
}
