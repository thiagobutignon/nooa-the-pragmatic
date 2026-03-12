import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { runTrace as runTraceExecute } from "./execute";

export type TraceAction = "inspect" | "help";

export const traceMeta: AgentDocMeta = {
	name: "trace",
	description: "Capture agent-first execution traces for local commands",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const traceHelp = `
Usage: nooa trace <subcommand> [flags] -- <command...>

Capture agent-first execution traces for local commands.

Subcommands:
  inspect              Run a command and persist a compact execution trace.

Flags:
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa trace inspect -- node script.js
  nooa trace inspect -- bun test src/features/debug

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  trace.missing_subcommand: Missing subcommand.
  trace.invalid_target: Unsupported or missing runtime command.
  trace.runtime_error: Trace capture failed.
`;

export const traceSdkUsage = `
SDK Usage:
  const result = await trace.run({ action: "inspect", command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.traceId);
`;

export const traceUsage = {
	cli: "nooa trace <subcommand> [flags] -- <command...>",
	sdk: 'await trace.run({ action: "inspect", command: ["node", "script.js"] })',
	tui: "TraceConsole()",
};

export const traceSchema = {
	action: { type: "string", required: true },
	command: { type: "array", required: false },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const traceOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "traceId", type: "string" },
	{ name: "command", type: "array" },
	{ name: "cwd", type: "string" },
	{ name: "durationMs", type: "number" },
	{ name: "exitCode", type: "number" },
	{ name: "stdoutSummary", type: "string" },
	{ name: "stderrSummary", type: "string" },
	{ name: "filesTouched", type: "array" },
];

export const traceErrors = [
	{ code: "trace.missing_subcommand", message: "Missing subcommand." },
	{
		code: "trace.invalid_target",
		message: "Unsupported or missing runtime command.",
	},
	{ code: "trace.runtime_error", message: "Trace capture failed." },
];

export const traceExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const traceExamples = [
	{
		input: "nooa trace inspect -- node script.js",
		output: "Run a command and persist a compact execution trace.",
	},
];

export interface TraceRunInput {
	action?: TraceAction;
	command?: string[];
	json?: boolean;
	cwd?: string;
}

export interface TraceRunResult {
	mode: string;
	raw?: string;
	traceId?: string;
	command?: string[];
	cwd?: string;
	durationMs?: number;
	exitCode?: number | null;
	stdoutSummary?: string;
	stderrSummary?: string;
	filesTouched?: string[];
}

export async function traceRun(
	input: TraceRunInput,
): Promise<SdkResult<TraceRunResult>> {
	if (!input.action) {
		return {
			ok: false,
			error: sdkError("trace.missing_subcommand", "Missing subcommand."),
		};
	}

	if (input.action === "help") {
		return {
			ok: true,
			data: {
				mode: "help",
				raw: traceHelp,
			},
		};
	}

	return await runTraceExecute(input);
}

const traceBuilder = new CommandBuilder<TraceRunInput, TraceRunResult>()
	.meta(traceMeta)
	.usage(traceUsage)
	.schema(traceSchema)
	.help(traceHelp)
	.sdkUsage(traceSdkUsage)
	.outputFields(traceOutputFields)
	.examples(traceExamples)
	.errors(traceErrors)
	.exitCodes(traceExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values, rawArgs }) => {
		const sourceArgs = rawArgs ?? positionals;
		const delimiterIndex = sourceArgs.indexOf("--");
		return {
			action: (positionals[1] as TraceAction | undefined) ?? undefined,
			command: delimiterIndex >= 0 ? sourceArgs.slice(delimiterIndex + 1) : [],
			json: Boolean(values.json),
		};
	})
	.run(traceRun)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		if (output.mode === "help" && output.raw) {
			console.log(output.raw);
			return;
		}
		console.log(`Trace: ${output.traceId}`);
		console.log(`Exit code: ${output.exitCode ?? ""}`);
		console.log(`Duration: ${output.durationMs ?? 0}ms`);
		if (output.stdoutSummary) {
			console.log(`Stdout: ${output.stdoutSummary}`);
		}
		if (output.stderrSummary) {
			console.log(`Stderr: ${output.stderrSummary}`);
		}
		if (output.filesTouched?.length) {
			console.log("Files touched:");
			for (const file of output.filesTouched.slice(0, 10)) {
				console.log(`- ${file}`);
			}
		}
	})
	.onFailure((error) => {
		if (error.code === "trace.missing_subcommand") {
			console.log(traceHelp);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["trace.missing_subcommand", "trace.invalid_target"]);
	})
	.telemetry({
		eventPrefix: "trace",
		successMetadata: (_, output) => ({
			mode: output.mode,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const traceAgentDoc = traceBuilder.buildAgentDoc(false);
export const traceFeatureDoc = (includeChangelog: boolean) =>
	traceBuilder.buildFeatureDoc(includeChangelog);

const traceCommand = traceBuilder.build();

export default traceCommand;
