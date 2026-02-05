import type { Gate, GateResult, WorkflowContext } from "../types";

export class DogfoodGate implements Gate {
	id = "dogfood";
	description = "Dogfooding completed";

	async check(_ctx: WorkflowContext): Promise<GateResult> {
		// Placeholder: real dogfood validation will be wired in Phase 2.3
		return { ok: true };
	}
}
