import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { dropSubcommandPositionals } from "./helpers";

export const mcpMeta: AgentDocMeta = {
	name: "mcp",
	description:
		"Manage MCP integrations (list, install, enable, disable, call, health)",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const mcpHelp = `
Usage: nooa mcp <subcommand> [options]

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
  nooa mcp call filesystem read_file --path README.md

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  mcp.missing_subcommand: Missing subcommand
  mcp.unknown_subcommand: Unknown subcommand
  mcp.runtime_error: MCP command failed
`;

export const mcpSdkUsage = `
SDK Usage:
  await mcp.run({ command: "list" });
  await mcp.run({ command: "call", args: ["filesystem", "read_file", "--path", "README.md"] });
`;

export const mcpUsage = {
	cli: "nooa mcp <subcommand> [options]",
	sdk: "await mcp.run({ command: \"list\" })",
	tui: "McpConsole()",
};

export const mcpSchema = {
	command: { type: "string", required: true },
	args: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const mcpOutputFields = [
	{ name: "result", type: "string" },
];

export const mcpErrors = [
	{ code: "mcp.missing_subcommand", message: "Missing subcommand." },
	{ code: "mcp.unknown_subcommand", message: "Unknown subcommand." },
	{ code: "mcp.runtime_error", message: "MCP command failed." },
];

export const mcpExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const mcpExamples = [
	{ input: "nooa mcp list", output: "List MCP servers" },
	{ input: "nooa mcp call filesystem read_file --path README.md", output: "Call tool" },
];

export interface McpRunInput {
	command?: string;
	args?: string[];
	json?: boolean;
	rawArgs?: string[];
}

export interface McpRunResult {
	result: number;
}

export async function run(
	input: McpRunInput,
): Promise<SdkResult<McpRunResult>> {
	const command = input.command;
	if (!command) {
		return {
			ok: false,
			error: sdkError("mcp.missing_subcommand", "Missing subcommand."),
		};
	}

	try {
		const { loadCommand } = await import("./loader");
		const cmdFn = await loadCommand(command);
		if (!cmdFn) {
			return {
				ok: false,
				error: sdkError(
					"mcp.unknown_subcommand",
					`Unknown subcommand: ${command}`,
				),
			};
		}

		const args = input.args ?? [];
		const normalizedArgs = args[0] === command ? args.slice(1) : args;
		const exitCode = await cmdFn(normalizedArgs);
		return { ok: true, data: { result: exitCode } };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("mcp.runtime_error", message),
		};
	}
}

const mcpBuilder = new CommandBuilder<McpRunInput, McpRunResult>()
	.meta(mcpMeta)
	.usage(mcpUsage)
	.schema(mcpSchema)
	.help(mcpHelp)
	.sdkUsage(mcpSdkUsage)
	.outputFields(mcpOutputFields)
	.examples(mcpExamples)
	.errors(mcpErrors)
	.exitCodes(mcpExitCodes)
	.options({ options: buildStandardOptions(), strict: false })
	.parseInput(async ({ positionals, values, rawArgs }) => {
		const normalized = dropSubcommandPositionals(positionals, "mcp");
		const args =
			rawArgs && rawArgs.length > 0 ? rawArgs.slice(1) : normalized.slice(1);
		return {
			command: normalized[0],
			args,
			json: Boolean(values.json),
			rawArgs,
		};
	})
	.run(run)
	.onSuccess((output) => {
		process.exitCode = output.result;
	})
	.onFailure((error) => {
		if (error.code === "mcp.missing_subcommand") {
			console.log(mcpHelp);
			process.exitCode = 2;
			return;
		}
		if (error.code === "mcp.unknown_subcommand") {
			console.error(error.message);
			console.error('Run "nooa mcp --help" for usage');
			process.exitCode = 1;
			return;
		}
		handleCommandError(error, ["mcp.missing_subcommand", "mcp.unknown_subcommand"]);
	})
	.telemetry({
		eventPrefix: "mcp",
		successMetadata: (input, output) => ({
			command: input.command,
			exit_code: output.result,
		}),
		failureMetadata: (input, error) => ({
			command: input.command,
			error: error.message,
		}),
	});

export const mcpAgentDoc = mcpBuilder.buildAgentDoc(false);
export const mcpFeatureDoc = (includeChangelog: boolean) =>
	mcpBuilder.buildFeatureDoc(includeChangelog);

const mcpCliCommand = mcpBuilder.build();

export async function mcpCommand(args: string[]): Promise<number> {
	const { EventBus } = await import("../../core/event-bus");
	const bus = new EventBus();
	if (args.length === 0) {
		console.log(mcpHelp);
		return 0;
	}
	process.exitCode = 0;
	await mcpCliCommand.execute({
		args: ["mcp", ...args],
		rawArgs: ["mcp", ...args],
		values: {},
		bus,
	});
	const code = process.exitCode ?? 0;
	process.exitCode = 0;
	return code;
}

export default mcpCliCommand;
