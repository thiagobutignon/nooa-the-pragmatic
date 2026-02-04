import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { ActEngine } from "./engine";

export const actMeta: AgentDocMeta = {
	name: "act",
	description: "Autonomous agent orchestrator",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const actHelp = `
Usage: nooa act <goal> [flags]

Orchestrate multiple commands to achieve a high-level goal.
The agent perceives capabilities via self-describing modules (AgentDocs).

Arguments:
  <goal>         The objective to achieve (e.g. "Check code and fix lint errors").

Flags:
  --model <name>      LLM model to use (default: configured in env).
  --provider <name>   LLM provider (default: ollama).
  --turns <number>    Max turns (default: 10).
  --json              Output result as JSON.
  -h, --help          Show help message.

Examples:
  nooa act "Get the title of README.md"
  nooa act "Run CI and summarize failures" --model gpt-4

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  act.missing_goal: Goal is required
  act.max_turns_exceeded: Goal not achieved within turn limit
  act.runtime_error: Execution failed
`;

export const actSdkUsage = `
SDK Usage:
  const result = await act.run({ goal: "Fix bugs" });
  if (result.ok) console.log(result.data.finalAnswer);
`;

export const actUsage = {
	cli: "nooa act <goal> [flags]",
	sdk: "await act.run({ goal: \"Fix bugs\" })",
	tui: "ActConsole()",
};

export const actSchema = {
	goal: { type: "string", required: true },
	model: { type: "string", required: false },
	provider: { type: "string", required: false },
	turns: { type: "number", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const actOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "history", type: "string" },
	{ name: "finalAnswer", type: "string" },
];

export const actErrors = [
	{ code: "act.missing_goal", message: "Goal is required." },
	{
		code: "act.max_turns_exceeded",
		message: "Goal not achieved within turn limit.",
	},
	{ code: "act.runtime_error", message: "Execution failed." },
];

export const actExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime Error" },
	{ value: "2", description: "Validation Error" },
];

export const actExamples = [
	{ input: "nooa act 'Check status'", output: "Orchestration result" },
];

export interface ActRunInput {
	goal?: string;
	model?: string;
	provider?: string;
	turns?: number;
	json?: boolean;
}

export interface ActRunResult {
	ok: boolean;
	history: Array<{ role: string; content: string }>;
	finalAnswer: string;
}

export async function run(
	input: ActRunInput,
): Promise<SdkResult<ActRunResult>> {
	if (!input.goal) {
		return {
			ok: false,
			error: sdkError("act.missing_goal", "Goal is required."),
		};
	}

	try {
		const engine = new ActEngine();
		const result = await engine.execute(input.goal, {
			model: input.model,
			provider: input.provider,
			maxTurns: input.turns,
		});

		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("act.runtime_error", message),
		};
	}
}

const actBuilder = new CommandBuilder<ActRunInput, ActRunResult>()
	.meta(actMeta)
	.usage(actUsage)
	.schema(actSchema)
	.help(actHelp)
	.sdkUsage(actSdkUsage)
	.outputFields(actOutputFields)
	.examples(actExamples)
	.errors(actErrors)
	.exitCodes(actExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			model: { type: "string" },
			provider: { type: "string" },
			turns: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values }) => {
		const turnsRaw = typeof values.turns === "string" ? values.turns : undefined;
		const turnsParsed = turnsRaw ? Number.parseInt(turnsRaw, 10) : undefined;
		return {
			goal: positionals[1],
			model: typeof values.model === "string" ? values.model : undefined,
			provider: typeof values.provider === "string" ? values.provider : undefined,
			turns: Number.isNaN(turnsParsed) ? undefined : turnsParsed,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		console.log(`\n🏁 Result: ${output.finalAnswer}`);
	})
	.onFailure((error) => {
		handleCommandError(error, ["act.missing_goal", "act.max_turns_exceeded"]);
	})
	.telemetry({
		eventPrefix: "act",
		successMetadata: (_, output) => ({
			turns: output.history.length,
		}),
		failureMetadata: (input, error) => ({
			goal: input.goal,
			error: error.message,
		}),
	});

export const actAgentDoc = actBuilder.buildAgentDoc(false);
export const actFeatureDoc = (includeChangelog: boolean) =>
	actBuilder.buildFeatureDoc(includeChangelog);

const actCommand = actBuilder.build();

export default actCommand;
