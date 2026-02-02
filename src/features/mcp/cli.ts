import { parseArgs } from "node:util";

export async function mcpCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help || positionals.length === 0) {
		console.log(`Usage: nooa mcp <subcommand> [options]

Subcommands:
  list         List installed/enabled/available MCPs
  install      Install an MCP server
  enable       Enable an MCP server
  disable      Disable an MCP server  
  call         Execute an MCP tool
  info         Show MCP server information
  configure    Configure MCP server settings

Options:
  -h, --help   Show this help message

Examples:
  nooa mcp list --enabled
  nooa mcp install @modelcontextprotocol/server-filesystem
  nooa mcp enable filesystem
  nooa mcp call filesystem read_file --path README.md`);
		return 0;
	}

	const subcommand = positionals[0];
	const _subArgs = positionals.slice(1);

	// Import subcommands dynamically
	switch (subcommand) {
		case "list": {
			const { listCommand } = await import("./list");
			return await listCommand(rawArgs.slice(1));
		}

		case "install": {
			const { installCommand } = await import("./install");
			return await installCommand(rawArgs.slice(1));
		}

		case "enable": {
			const { enableCommand } = await import("./enable");
			return await enableCommand(rawArgs.slice(1));
		}

		case "disable": {
			const { disableCommand } = await import("./disable");
			return await disableCommand(rawArgs.slice(1));
		}

		case "call": {
			const { callCommand } = await import("./call");
			return await callCommand(rawArgs.slice(1));
		}

		case "info":
			console.log("MCP info command not yet implemented");
			return 1;

		case "configure":
			console.log("MCP configure command not yet implemented");
			return 1;

		default:
			console.error(`Unknown subcommand: ${subcommand}`);
			console.error('Run "nooa mcp --help" for usage');
			return 1;
	}
}
