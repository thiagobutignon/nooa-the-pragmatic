import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";
import type { McpServer } from "../../core/mcp/types";
import { openMcpDatabase } from "../../core/mcp/db";
import { deriveServerName, parseEnvEntries } from "./helpers";

export async function installCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			name: { type: "string" },
			command: { type: "string" },
			args: { type: "string", multiple: true },
			env: { type: "string", multiple: true },
			force: { type: "boolean" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp install <package> [options]

Arguments:
  package        NPM package name, git URL, or local path

Options:
  --name <name>     Override the MCP name (defaults to derived name)
  --command <cmd>   Binary to execute (default: bun)
  --args <arg>      Arguments to pass to the binary (repeatable)
  --env <KEY=VAL>   Environment variables for the MCP (repeatable)
  --force           Overwrite an existing MCP with the same name
  -h, --help        Show this help message

Examples:
  nooa mcp install @modelcontextprotocol/server-filesystem
  nooa mcp install ./local-mcp --name local --command node --args ./server.cjs
  nooa mcp install github:user/mcp --env GITHUB_TOKEN=xxx
`);
		return 0;
	}

	if (positionals.length === 0) {
		console.error("Error: Package name required");
		console.error('Run "nooa mcp install --help" for usage');
		return 2;
	}

	const packageName = positionals[0];
	const desiredName =
		(values.name as string | undefined) ||
		positionals[1] ||
		deriveServerName(packageName);

	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const existing = await registry.get(desiredName);
		if (existing && !values.force) {
			console.error(
				`Error: MCP "${desiredName}" already exists. Use --force to replace it.`,
			);
			return 1;
		}

		const server: McpServer = {
			id: randomUUID(),
			name: desiredName,
			package: packageName,
			command: (values.command as string | undefined) ?? "bun",
			args: (values.args as string[] | undefined) ?? [],
			env: parseEnvEntries(values.env as string[] | undefined),
			enabled: true,
		};

		await registry.add(server);
		console.log(`✅ Installed MCP "${server.name}"`);
		console.log(`🔧 Command: ${server.command} ${server.args.join(" ")}`);
		console.log(`📦 Package: ${server.package}`);
		return 0;
	} finally {
		db.close();
	}
}
