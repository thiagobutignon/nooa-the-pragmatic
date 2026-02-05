export interface WorkflowContext {
	traceId: string;
	command: string;
	args: Record<string, unknown>;
	cwd: string;
	worktree?: string;
}

export type GateResult =
	| { ok: true }
	| { ok: false; reason: string; suggestions?: string[] };

export interface Gate {
	id: string;
	description: string;
	check(ctx: WorkflowContext): Promise<GateResult>;
}

export interface WorkflowStep {
	id: string;
	gate: Gate;
	action: (ctx: WorkflowContext) => Promise<unknown>;
}

export interface WorkflowRunResult {
	ok: boolean;
	failedStepId?: string;
	reason?: string;
}
