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
  init         Onboard recommended MCPs
  list         List installed/enabled/available MCPs
  install      Install an MCP server
  enable       Enable an MCP server
  disable      Disable an MCP server  
  call         Execute an MCP tool
  resource     Read an MCP resource URI
  info         Show MCP server information
  configure    Configure MCP server settings
  uninstall    Remove an MCP configuration
  test         Ping an MCP server

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

		case "resource": {
			const { resourceCommand } = await import("./resource");
			return await resourceCommand(rawArgs.slice(1));
		}

		case "info": {
			const { infoCommand } = await import("./info");
			return await infoCommand(rawArgs.slice(1));
		}

		case "configure": {
			const { configureCommand } = await import("./configure");
			return await configureCommand(rawArgs.slice(1));
		}

		case "uninstall": {
			const { uninstallCommand } = await import("./uninstall");
			return await uninstallCommand(rawArgs.slice(1));
		}

		case "test": {
			const { testCommand } = await import("./test");
			return await testCommand(rawArgs.slice(1));
		}

		default:
			console.error(`Unknown subcommand: ${subcommand}`);
			console.error('Run "nooa mcp --help" for usage');
			return 1;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Dynamic command registration
const mcpCommandObject: any = {
	name: "mcp",
	description: "Manage MCP integrations (list, install, enable, disable, call)",
	// biome-ignore lint/suspicious/noExplicitAny: Raw args are dynamic
	execute: async ({ rawArgs }: any) => {
		return await mcpCommand(rawArgs);
	},
};

export default mcpCommandObject;
