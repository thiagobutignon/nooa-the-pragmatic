import { randomUUID } from "node:crypto";
import { executePipeline } from "../features/run/executor";
import { parsePipelineArgs } from "../features/run/parser";
import type { PipelineStep, RunOptions, StepResult } from "../features/run/types";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface RunInput {
	args?: string[];
	steps?: PipelineStep[];
	continueOnError?: boolean;
	captureOutput?: boolean;
	allowExternal?: boolean;
	dryRun?: boolean;
	cwd?: string;
}

export interface RunResult {
	runId: string;
	ok: boolean;
	failedStepIndex?: number;
	steps: StepResult[];
	plan?: PipelineStep[];
}

export async function run(input: RunInput): Promise<SdkResult<RunResult>> {
	const steps = input.steps ?? (input.args ? parsePipelineArgs(input.args) : []);
	if (steps.length === 0) {
		return {
			ok: false,
			error: sdkError("invalid_input", "No pipeline steps provided."),
		};
	}

	const options: RunOptions = {
		json: false,
		captureOutput: input.captureOutput ?? false,
		continueOnError: input.continueOnError ?? false,
		allowExternal: input.allowExternal ?? false,
		cwd: input.cwd ?? process.cwd(),
	};

	if (input.dryRun) {
		return {
			ok: true,
			data: {
				runId: randomUUID(),
				ok: true,
				steps: [],
				plan: steps,
			},
		};
	}

	const result = await executePipeline(steps, options);
	return {
		ok: true,
		data: {
			runId: randomUUID(),
			ok: result.ok,
			failedStepIndex: result.failedStepIndex,
			steps: result.steps,
		},
	};
}

export const runSdk = {
	run,
};
