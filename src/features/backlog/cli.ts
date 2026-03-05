import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { BacklogAction, BacklogMode } from "./types";

export interface BacklogRunInput {
	action?: BacklogAction;
	json?: boolean;
}

export interface BacklogRunResult {
	mode: BacklogMode;
	raw?: string;
	message?: string;
}

export const backlogMeta: AgentDocMeta = {
	name: "backlog",
	description: "Generate and operate backlog PRDs and kanban state",
	changelog: [{ version: "1.0.0", changes: ["Initial backlog command scaffold"] }],
};

export const backlogHelp = `
Usage: nooa backlog <subcommand> [args] [flags]

Generate and operate backlog PRDs and kanban state.

Subcommands:
  generate              Generate a PRD from a macro prompt.
  validate              Validate PRD schema compatibility.
  split                 Split large stories into smaller units.
  board                 Render board columns from PRD state.
  move                  Move one story between board columns.

Flags:
  --json                Output results as JSON.
  -h, --help            Show help message.

Examples:
  nooa backlog --help
  nooa backlog generate --help
  nooa backlog board --help

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  backlog.missing_action: Subcommand required
  backlog.invalid_action: Unknown subcommand
  backlog.runtime_error: Unexpected error
`;

export const backlogUsage = {
	cli: "nooa backlog <subcommand> [args] [flags]",
	sdk: 'await backlog.run({ action: "help" })',
};

export const backlogSdkUsage = `
SDK Usage:
  const result = await backlog.run({ action: "help" });
  if (result.ok) console.log(result.data.mode);
`;

export const backlogSchema = {
	action: { type: "string", required: true },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const backlogOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "raw", type: "string" },
	{ name: "message", type: "string" },
];

export const backlogErrors = [
	{ code: "backlog.missing_action", message: "Subcommand required." },
	{ code: "backlog.invalid_action", message: "Unknown subcommand." },
	{ code: "backlog.runtime_error", message: "Unexpected error." },
];

export const backlogExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const backlogExamples = [
	{
		input: "nooa backlog --help",
		output: "Show subcommand contract for backlog operations.",
	},
];

export async function run(
	input: BacklogRunInput,
): Promise<SdkResult<BacklogRunResult>> {
	const action = input.action;
	if (!action || action === "help") {
		return {
			ok: true,
			data: {
				mode: "help",
				raw: backlogHelp,
			},
		};
	}

	if (
		action !== "generate" &&
		action !== "validate" &&
		action !== "split" &&
		action !== "board" &&
		action !== "move"
	) {
		return {
			ok: false,
			error: sdkError("backlog.invalid_action", `Unknown subcommand: ${action}`),
		};
	}

	return {
		ok: true,
		data: {
			mode: action,
			message: `backlog ${action} scaffold ready`,
		},
	};
}

const backlogBuilder = new CommandBuilder<BacklogRunInput, BacklogRunResult>()
	.meta(backlogMeta)
	.usage(backlogUsage)
	.schema(backlogSchema)
	.help(backlogHelp)
	.sdkUsage(backlogSdkUsage)
	.outputFields(backlogOutputFields)
	.examples(backlogExamples)
	.errors(backlogErrors)
	.exitCodes(backlogExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values }) => {
		const commandIndex = positionals.indexOf("backlog");
		const action = positionals[commandIndex + 1] as BacklogAction | undefined;
		return {
			action,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({
				schemaVersion: "1.0",
				command: "backlog",
				action: output.mode,
				timestamp: new Date().toISOString(),
				...output,
			});
			return;
		}
		if (output.mode === "help" && output.raw) {
			console.log(output.raw);
			return;
		}
		if (output.message) {
			console.log(output.message);
		}
	})
	.onFailure((error) => {
		handleCommandError(error, ["backlog.missing_action", "backlog.invalid_action"]);
	})
	.telemetry({
		eventPrefix: "backlog",
		successMetadata: (_, output) => ({ mode: output.mode }),
		failureMetadata: (_, error) => ({ error: error.message }),
	});

export const backlogAgentDoc = backlogBuilder.buildAgentDoc(false);
export const backlogFeatureDoc = (includeChangelog: boolean) =>
	backlogBuilder.buildFeatureDoc(includeChangelog);

const backlogCommand = backlogBuilder.build();

export default backlogCommand;
