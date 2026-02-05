import type { Gate, GateResult, WorkflowContext } from "../types";

export class TestGate implements Gate {
	id = "tests";
	description = "Tests are green";

	async check(_ctx: WorkflowContext): Promise<GateResult> {
		// Placeholder: real test execution will be wired in Phase 2.2
		return { ok: true };
	}
}
