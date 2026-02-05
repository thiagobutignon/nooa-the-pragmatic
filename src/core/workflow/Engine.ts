import type { WorkflowContext, WorkflowRunResult, WorkflowStep } from "./types";

export class WorkflowEngine {
	async run(
		steps: WorkflowStep[],
		ctx: WorkflowContext,
	): Promise<WorkflowRunResult> {
		for (const step of steps) {
			const gateResult = await step.gate.check(ctx);
			if (!gateResult.ok) {
				return {
					ok: false,
					failedStepId: step.id,
					reason: gateResult.reason,
				};
			}
			await step.action(ctx);
		}
		return { ok: true };
	}
}
