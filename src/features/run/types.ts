export type StepKind = "internal" | "external";

export interface PipelineStep {
	kind: StepKind;
	argv: string[];
	original: string;
}

export interface RunOptions {
	json: boolean;
	captureOutput: boolean;
	continueOnError: boolean;
	allowExternal: boolean;
	cwd?: string;
}

export interface StepResult {
	step: PipelineStep;
	exitCode: number;
	durationMs: number;
	error?: string;
	stdout?: string;
	stderr?: string;
}

export interface PipelineResult {
	ok: boolean;
	failedStepIndex?: number;
	steps: StepResult[];
}
