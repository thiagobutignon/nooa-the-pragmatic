import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { runRecordInspect as runRecordExecute } from "./execute";

export type RecordAction = "inspect" | "help";

export const recordMeta: AgentDocMeta = {
	name: "record",
	description: "Capture agent-first raw execution records for local commands",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const recordHelp = `
Usage: nooa record <subcommand> [flags] -- <command...>

Capture agent-first raw execution records for local commands.

Subcommands:
  inspect              Run a command and persist a raw execution record.

Flags:
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa record inspect -- node script.js
  nooa record inspect -- bun test src/features/debug

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  record.missing_subcommand: Missing subcommand.
  record.invalid_target: Unsupported or missing runtime command.
  record.runtime_error: Record capture failed.
`;

export const recordSdkUsage = `
SDK Usage:
  const result = await record.run({ action: "inspect", command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.recordId);
`;

export const recordUsage = {
	cli: "nooa record <subcommand> [flags] -- <command...>",
	sdk: 'await record.run({ action: "inspect", command: ["node", "script.js"] })',
	tui: "RecordConsole()",
};

export const recordSchema = {
	action: { type: "string", required: true },
	command: { type: "array", required: false },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const recordOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "recordId", type: "string" },
	{ name: "traceId", type: "string" },
	{ name: "command", type: "array" },
	{ name: "cwd", type: "string" },
	{ name: "stdout", type: "string" },
	{ name: "stderr", type: "string" },
	{ name: "filesTouched", type: "array" },
];

export const recordErrors = [
	{ code: "record.missing_subcommand", message: "Missing subcommand." },
	{
		code: "record.invalid_target",
		message: "Unsupported or missing runtime command.",
	},
	{ code: "record.runtime_error", message: "Record capture failed." },
];

export const recordExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const recordExamples = [
	{
		input: "nooa record inspect -- node script.js",
		output: "Run a command and persist a raw execution record.",
	},
];

export interface RecordRunInput {
	action?: RecordAction;
	command?: string[];
	json?: boolean;
	cwd?: string;
}

export interface RecordRunResult {
	mode: string;
	raw?: string;
	recordId?: string;
	traceId?: string;
	command?: string[];
	cwd?: string;
	stdout?: string;
	stderr?: string;
	filesTouched?: string[];
}

export async function recordRun(
	input: RecordRunInput,
): Promise<SdkResult<RecordRunResult>> {
	if (!input.action) {
		return {
			ok: false,
			error: sdkError("record.missing_subcommand", "Missing subcommand."),
		};
	}

	if (input.action === "help") {
		return {
			ok: true,
			data: {
				mode: "help",
				raw: recordHelp,
			},
		};
	}

	return await runRecordExecute(input);
}

const recordBuilder = new CommandBuilder<RecordRunInput, RecordRunResult>()
	.meta(recordMeta)
	.usage(recordUsage)
	.schema(recordSchema)
	.help(recordHelp)
	.sdkUsage(recordSdkUsage)
	.outputFields(recordOutputFields)
	.examples(recordExamples)
	.errors(recordErrors)
	.exitCodes(recordExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values, rawArgs }) => {
		const sourceArgs = rawArgs ?? positionals;
		const delimiterIndex = sourceArgs.indexOf("--");
		return {
			action: (positionals[1] as RecordAction | undefined) ?? undefined,
			command: delimiterIndex >= 0 ? sourceArgs.slice(delimiterIndex + 1) : [],
			json: Boolean(values.json),
		};
	})
	.run(recordRun)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		if (output.mode === "help" && output.raw) {
			console.log(output.raw);
			return;
		}
		console.log(`Record: ${output.recordId}`);
		console.log(`Trace: ${output.traceId}`);
		if (output.stdout) {
			console.log(`Stdout: ${output.stdout}`);
		}
		if (output.stderr) {
			console.log(`Stderr: ${output.stderr}`);
		}
		if (output.filesTouched?.length) {
			console.log("Files touched:");
			for (const file of output.filesTouched.slice(0, 10)) {
				console.log(`- ${file}`);
			}
		}
	})
	.onFailure((error) => {
		if (error.code === "record.missing_subcommand") {
			console.log(recordHelp);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, [
			"record.missing_subcommand",
			"record.invalid_target",
		]);
	})
	.telemetry({
		eventPrefix: "record",
		successMetadata: (_, output) => ({
			mode: output.mode,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const recordAgentDoc = recordBuilder.buildAgentDoc(false);
export const recordFeatureDoc = (includeChangelog: boolean) =>
	recordBuilder.buildFeatureDoc(includeChangelog);

const recordCommand = recordBuilder.build();

export default recordCommand;
