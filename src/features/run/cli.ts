import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJson,
	setExitCode
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { executePipeline } from "./executor";
import { parsePipelineArgs } from "./parser";
import type { PipelineResult, PipelineStep, RunOptions } from "./types";
import type { EventBus } from "../../core/event-bus";
import { randomUUID } from "node:crypto";

export const runMeta: AgentDocMeta = {
	name: "run",
	description: "Execute multiple commands in a pipeline",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const runHelp = `
Usage: nooa run [flags] -- <cmd1> -- <cmd2> ...
       nooa run [flags] "cmd1" "cmd2" ...

Execute multiple commands in a pipeline.

Modes:
  1. Delimiter Mode (Recommended): Separate commands with --
     nooa run -- code write foo.ts -- commit -m "feat: foo"

  2. String Mode: Pass commands as quoted strings
     nooa run "code write foo.ts" "commit -m 'feat: foo'"

Flags:
  --continue-on-error   Continue to next step even if a step fails.
  --json                Output results as JSON (includes schemaVersion and runId).
  --capture-output      Capture stdout/stderr for each step (external commands only).
  --allow-external      Allow executing non-nooa commands (without 'exec' prefix).
  --dry-run             Parse and show plan without executing.
  -h, --help            Show help message.

Exit Codes:
  0: Success
  1: Runtime Error (failed command)
  2: Validation Error (missing commands)

Error Codes:
  run.missing_steps: No commands provided
  run.runtime_error: Pipeline failed
`;

export const runSdkUsage = `
SDK Usage:
  const result = await run.run({
    steps: [\"code write foo.ts\", \"commit -m 'feat: foo'\"],
    continueOnError: false
  });
  if (result.ok) console.log(result.data.steps.length);
`;

export const runUsage = {
	cli: "nooa run [flags] -- <cmd1> -- <cmd2> ...",
	sdk: "await run.run({ steps: [\"code write foo.ts\"] })",
	tui: "RunPipelineConsole()",
};

export const runSchema = {
	steps: { type: "string", required: true },
	json: { type: "boolean", required: false },
	"dry-run": { type: "boolean", required: false },
	"continue-on-error": { type: "boolean", required: false },
	"capture-output": { type: "boolean", required: false },
	"allow-external": { type: "boolean", required: false },
} satisfies SchemaSpec;

export const runOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "failedStepIndex", type: "number" },
	{ name: "steps", type: "string" },
];

export const runErrors = [
	{ code: "run.missing_steps", message: "No commands provided." },
	{ code: "run.runtime_error", message: "Pipeline failed." },
];

export const runExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const runExamples = [
	{
		input: "nooa run -- code write foo.ts -- commit -m \"feat: foo\"",
		output: "Pipeline executed",
	},
	{
		input: "nooa run \"code write foo.ts\" \"commit -m 'feat: foo'\"",
		output: "Pipeline executed",
	},
];

export interface RunRunInput {
	steps?: string[];
	json?: boolean;
	dryRun?: boolean;
	continueOnError?: boolean;
	captureOutput?: boolean;
	allowExternal?: boolean;
	cwd?: string;
	bus?: EventBus;
}

export interface RunRunResult {
	ok: boolean;
	failedStepIndex?: number;
	steps: Array<{
		step: PipelineStep;
		exitCode: number;
		durationMs: number;
		error?: string;
		stdout?: string;
		stderr?: string;
	}>;
}

function buildPipelineArgs(steps: string[]) {
	return steps.map((step) => step.trim());
}

export async function run(
	input: RunRunInput,
): Promise<SdkResult<RunRunResult>> {
	if (!input.steps || input.steps.length === 0) {
		return {
			ok: false,
			error: sdkError("run.missing_steps", "No commands provided."),
		};
	}

	const args = buildPipelineArgs(input.steps);
	const pipeline = parsePipelineArgs(args);
	if (pipeline.length === 0) {
		return {
			ok: false,
			error: sdkError("run.missing_steps", "No commands provided."),
		};
	}

	if (input.dryRun) {
		return {
			ok: true,
			data: {
				ok: true,
				failedStepIndex: undefined,
				steps: pipeline.map((step) => ({
					step,
					exitCode: 0,
					durationMs: 0,
				})),
			},
		};
	}

	const options: RunOptions = {
		json: Boolean(input.json),
		captureOutput: Boolean(input.captureOutput),
		continueOnError: Boolean(input.continueOnError),
		allowExternal: Boolean(input.allowExternal),
		cwd: input.cwd ?? process.cwd(),
	};

	try {
		const result = await executePipeline(pipeline, options, input.bus);
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("run.runtime_error", "Pipeline failed.", { result }),
			};
		}
		return { ok: true, data: result };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("run.runtime_error", message),
		};
	}
}

const runBuilder = new CommandBuilder<RunRunInput, RunRunResult>()
	.meta(runMeta)
	.usage(runUsage)
	.schema(runSchema)
	.help(runHelp)
	.sdkUsage(runSdkUsage)
	.outputFields(runOutputFields)
	.examples(runExamples)
	.errors(runErrors)
	.exitCodes(runExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			"continue-on-error": { type: "boolean" },
			"capture-output": { type: "boolean" },
			"allow-external": { type: "boolean" },
			"dry-run": { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values, bus }) => {
		const steps = positionals.slice(1);
		if (!values.json && !values["dry-run"]) {
			const pipeline = parsePipelineArgs(steps);
			if (pipeline.length > 0) {
				console.log(`Running payload with ${pipeline.length} steps...`);
			}
		}
		return {
			steps,
			json: Boolean(values.json),
			dryRun: Boolean(values["dry-run"]),
			continueOnError: Boolean(values["continue-on-error"]),
			captureOutput: Boolean(values["capture-output"]),
			allowExternal: Boolean(values["allow-external"]),
			bus,
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values["dry-run"]) {
			renderJson(output.steps.map((step) => step.step));
			return;
		}

		if (values.json) {
			renderJson({
				schemaVersion: "1.0",
				runId: randomUUID(),
				ok: output.ok,
				failedStepIndex: output.failedStepIndex,
				steps: output.steps,
			});
			return;
		}
	})
	.onFailure((error, input) => {
		const result = error.details?.result as PipelineResult | undefined;
		if (error.code === "run.missing_steps") {
			console.error("Error: No commands provided.");
			console.log(runHelp);
			setExitCode(error, ["run.missing_steps"]);
			return;
		}

		if (input.json) {
			renderJson({
				schemaVersion: "1.0",
				runId: randomUUID(),
				ok: false,
				failedStepIndex: result?.failedStepIndex,
				steps: result?.steps ?? [],
				error: error.message,
			});
			if (result && typeof result.failedStepIndex === "number") {
				const failedStep = result.steps[result.failedStepIndex];
				process.exitCode = failedStep?.exitCode || 1;
			} else {
				process.exitCode = 1;
			}
			return;
		}

		if (result) {
			const failedIndex = result.failedStepIndex ?? -1;
			const failedStep = failedIndex >= 0 ? result.steps[failedIndex] : undefined;
			if (failedStep) {
				console.error(
					`Pipeline failed at step ${failedIndex + 1}: ${failedStep.step.original}`,
				);
				if (failedStep.error) console.error(failedStep.error);
				process.exitCode = failedStep.exitCode || 1;
				return;
			}
		}

		handleCommandError(error, ["run.missing_steps"]);
	})
	.telemetry({
		eventPrefix: "run",
		successMetadata: (_, output) => ({
			steps: output.steps.length,
			ok: output.ok,
			failed_step: output.failedStepIndex,
		}),
		failureMetadata: (input, error) => ({
			steps: input.steps?.length ?? 0,
			error: error.message,
		}),
	});

export const runAgentDoc = runBuilder.buildAgentDoc(false);
export const runFeatureDoc = (includeChangelog: boolean) =>
	runBuilder.buildFeatureDoc(includeChangelog);

const runCommand = runBuilder.build();

export default runCommand;
