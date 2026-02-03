import { parseArgs } from "node:util";
import { dropSubcommandPositionals } from "./helpers";

export async function mcpCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	const normalized = dropSubcommandPositionals(positionals, "mcp");

	if (values.help || normalized.length === 0) {
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
  alias        Manage stored MCP alias shortcuts
  uninstall    Remove an MCP configuration
  test         Ping an MCP server
  health       Check MCP server health

Options:
  -h, --help   Show this help message

Examples:
  nooa mcp list --enabled
  nooa mcp install @modelcontextprotocol/server-filesystem
  nooa mcp enable filesystem
  nooa mcp call filesystem read_file --path README.md`);
		return 0;
	}

	const subcommand = normalized[0];
	const _subArgs = normalized.slice(1);

	// Import subcommands dynamically
	// Import subcommands dynamically using loader
	const { loadCommand } = await import("./loader");
	const cmdFn = await loadCommand(subcommand);

	if (cmdFn) {
		return await cmdFn(rawArgs.slice(1));
	}

	console.error(`Unknown subcommand: ${subcommand}`);
	console.error('Run "nooa mcp --help" for usage');
	return 1;
}

// biome-ignore lint/suspicious/noExplicitAny: Dynamic command registration
const mcpCommandObject: any = {
	name: "mcp",
	description:
		"Manage MCP integrations (list, install, enable, disable, call, health)",
	// biome-ignore lint/suspicious/noExplicitAny: Raw args are dynamic
	execute: async ({ rawArgs }: any) => {
		return await mcpCommand(rawArgs);
	},
};

export default mcpCommandObject;
