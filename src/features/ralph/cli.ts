import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import {
	executeRalphRun,
	executeRalphStep,
	getRalphStatus,
	importRalphPrdFile,
	initializeRalphRun,
	type RalphImportPrdResult,
	type RalphInitResult,
	type RalphRunLoopResult,
	type RalphSelectStoryResult,
	type RalphStatusResult,
	type RalphStepResult,
	selectNextRalphStory,
} from "./execute";

export type RalphAction =
	| "init"
	| "status"
	| "import-prd"
	| "select-story"
	| "step"
	| "run"
	| "help";

export interface RalphRunInput {
	action?: RalphAction;
	path?: string;
	json?: boolean;
	maxIterations?: number;
}

export type RalphRunResult =
	| RalphInitResult
	| RalphStatusResult
	| RalphImportPrdResult
	| RalphSelectStoryResult
	| RalphStepResult
	| RalphRunLoopResult
	| { mode: "help"; raw: string };

export const ralphMeta: AgentDocMeta = {
	name: "ralph",
	description: "Run the Ralph backlog loop for autonomous feature delivery",
	changelog: [{ version: "1.0.0", changes: ["Initial init and status flows"] }],
};

export const ralphHelp = `
Usage: nooa ralph <subcommand> [args] [flags]

Run the Ralph backlog loop for autonomous feature delivery.

Subcommands:
  init                 Initialize .nooa/ralph/ state for the current branch.
  status               Show current Ralph run status.
  import-prd <path>    Import a Ralph-compatible prd.json into .nooa/ralph/.
  select-story         Select the next pending story from the active PRD.
  step                 Execute one story and stop at peer review.
  run                  Execute repeated fresh Ralph steps.

Flags:
  --json               Output results as JSON.
  --max-iterations <n> Maximum number of step iterations (default: 10).
  -h, --help           Show help message.

Examples:
  nooa ralph init
  nooa ralph status --json
  nooa ralph import-prd ./prd.json
  nooa ralph select-story --json
  nooa ralph step --json
  nooa ralph run --max-iterations 1 --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  ralph.missing_action: Subcommand required
  ralph.missing_path: Path required
  ralph.unsafe_state_path: .nooa/ralph/ is not git-ignored
  ralph.runtime_error: Unexpected error
`;

export const ralphSdkUsage = `
SDK Usage:
  await ralph.run({ action: "init" });
  const status = await ralph.run({ action: "status", json: true });
`;

export const ralphUsage = {
	cli: "nooa ralph <subcommand> [args] [flags]",
	sdk: 'await ralph.run({ action: "status" })',
};

export const ralphSchema = {
	action: { type: "string", required: true },
	path: { type: "string", required: false },
	json: { type: "boolean", required: false },
	"max-iterations": { type: "number", required: false },
} satisfies SchemaSpec;

export const ralphOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "initialized", type: "boolean" },
	{ name: "runId", type: "string" },
	{ name: "branchName", type: "string" },
	{ name: "status", type: "string" },
	{ name: "storyCounts", type: "string" },
	{ name: "path", type: "string" },
	{ name: "story", type: "string" },
	{ name: "ok", type: "boolean" },
	{ name: "reason", type: "string" },
	{ name: "iterations", type: "number" },
	{ name: "completedStories", type: "number" },
	{ name: "blockedStories", type: "number" },
];

export const ralphErrors = [
	{ code: "ralph.missing_action", message: "Subcommand required." },
	{ code: "ralph.missing_path", message: "Path required." },
	{
		code: "ralph.unsafe_state_path",
		message: ".nooa/ralph/ must be git-ignored before init.",
	},
	{ code: "ralph.runtime_error", message: "Unexpected error." },
];

export const ralphExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const ralphExamples = [
	{
		input: "nooa ralph init",
		output: "Initialize Ralph state in .nooa/ralph/.",
	},
	{
		input: "nooa ralph status --json",
		output: "Return the current Ralph status as JSON.",
	},
];

export async function run(
	input: RalphRunInput,
): Promise<SdkResult<RalphRunResult>> {
	const action = input.action;
	if (!action) {
		return {
			ok: false,
			error: sdkError("ralph.missing_action", "Subcommand required."),
		};
	}

	if (action === "help") {
		return { ok: true, data: { mode: "help", raw: ralphHelp } };
	}

	try {
		switch (action) {
			case "init":
				return {
					ok: true,
					data: await initializeRalphRun({
						workerProvider: process.env.NOOA_AI_PROVIDER,
						workerModel: process.env.NOOA_AI_MODEL,
						reviewerProvider:
							process.env.NOOA_REVIEW_AI_PROVIDER ??
							process.env.NOOA_AI_PROVIDER,
						reviewerModel:
							process.env.NOOA_REVIEW_AI_MODEL ?? process.env.NOOA_AI_MODEL,
						workerTimeoutMs: process.env.NOOA_WORKER_TIMEOUT_MS
							? Number(process.env.NOOA_WORKER_TIMEOUT_MS)
							: undefined,
						reviewerTimeoutMs: process.env.NOOA_REVIEWER_TIMEOUT_MS
							? Number(process.env.NOOA_REVIEWER_TIMEOUT_MS)
							: undefined,
					}),
				};
			case "status":
				return { ok: true, data: await getRalphStatus() };
			case "import-prd":
				if (!input.path) {
					return {
						ok: false,
						error: sdkError("ralph.missing_path", "Path required."),
					};
				}
				return {
					ok: true,
					data: await importRalphPrdFile({ path: input.path }),
				};
			case "select-story":
				return { ok: true, data: await selectNextRalphStory() };
			case "step":
				return { ok: true, data: await executeRalphStep() };
			case "run":
				return {
					ok: true,
					data: await executeRalphRun({
						maxIterations: input.maxIterations,
					}),
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("git-ignored")) {
			return {
				ok: false,
				error: sdkError("ralph.unsafe_state_path", message),
			};
		}
		return {
			ok: false,
			error: sdkError("ralph.runtime_error", message),
		};
	}
}

const ralphBuilder = new CommandBuilder<RalphRunInput, RalphRunResult>()
	.meta(ralphMeta)
	.usage(ralphUsage)
	.schema(ralphSchema)
	.help(ralphHelp)
	.sdkUsage(ralphSdkUsage)
	.outputFields(ralphOutputFields)
	.examples(ralphExamples)
	.errors(ralphErrors)
	.exitCodes(ralphExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			"max-iterations": { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values }) => {
		const commandIndex = positionals.indexOf("ralph");
		const action = positionals[commandIndex + 1] as RalphAction | undefined;
		const args = positionals.slice(commandIndex + 2);
		const maxIterationsRaw =
			typeof values["max-iterations"] === "string"
				? values["max-iterations"]
				: undefined;
		return {
			action,
			path: args[0],
			json: Boolean(values.json),
			maxIterations: maxIterationsRaw
				? Number.parseInt(maxIterationsRaw, 10)
				: undefined,
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({
				schemaVersion: "1.0",
				command: "ralph",
				action: output.mode,
				timestamp: new Date().toISOString(),
				...output,
			});
			return;
		}

		if (output.mode === "help") {
			console.log(output.raw);
			return;
		}

		if (output.mode === "init") {
			console.log(`Initialized Ralph run ${output.runId}`);
			console.log(`Branch: ${output.branchName}`);
			console.log(`State: ${output.statePath}`);
			console.log(`PRD: ${output.prdPath}`);
			return;
		}

		if (output.mode === "status") {
			if (!output.initialized) {
				console.log("Ralph has not been initialized in this workspace.");
				return;
			}
			console.log(`Run: ${output.runId}`);
			console.log(`Branch: ${output.branchName}`);
			console.log(`Status: ${output.status}`);
			console.log(`Pending stories: ${output.storyCounts.pending}`);
			return;
		}

		if (output.mode === "import-prd") {
			console.log(`Imported PRD from ${output.path}`);
			return;
		}

		if (output.mode === "step") {
			if (!output.ok) {
				console.log(output.reason ?? "Ralph step failed.");
				process.exitCode = 1;
				return;
			}
			console.log(
				`Executed story ${output.storyId}; state is now ${output.state}.`,
			);
			return;
		}

		if (output.mode === "run") {
			if (!output.ok) {
				console.log(output.reason ?? "Ralph run failed.");
				process.exitCode = 1;
				return;
			}
			console.log(
				`Ralph run completed in ${output.iterations} iteration(s); completed stories: ${output.completedStories}.`,
			);
			return;
		}

		if (output.story) {
			console.log(`Selected story: ${output.story.id} - ${output.story.title}`);
			return;
		}

		console.log("No eligible story found.");
	})
	.onFailure((error) => {
		handleCommandError(error, [
			"ralph.missing_action",
			"ralph.missing_path",
			"ralph.unsafe_state_path",
		]);
	})
	.telemetry({
		eventPrefix: "ralph",
		successMetadata: (_, output) => ({ mode: output.mode }),
		failureMetadata: (_, error) => ({ error: error.message }),
	});

export const ralphAgentDoc = ralphBuilder.buildAgentDoc(false);
export const ralphFeatureDoc = (includeChangelog: boolean) =>
	ralphBuilder.buildFeatureDoc(includeChangelog);

const ralphCommand = ralphBuilder.build();

export default ralphCommand;
