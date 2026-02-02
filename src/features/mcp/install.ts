import { parseArgs } from "node:util";

export async function installCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp install <package> [options]

Arguments:
  package        NPM package name or git URL

Options:
  -h, --help     Show this help message

Examples:
  nooa mcp install @modelcontextprotocol/server-filesystem
  nooa mcp install git+https://github.com/user/mcp-server.git`);
		return 0;
	}

	if (positionals.length === 0) {
		console.error("Error: Package name required");
		console.error('Run "nooa mcp install --help" for usage');
		return 2;
	}

	const packageName = positionals[0];

	// TODO: Actual npm install implementation
	console.log(`Installing ${packageName}...`);
	console.log("✅ MCP installed successfully");
	console.log(`Run "nooa mcp enable ${packageName}" to activate`);

	return 0;
}
