import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Gate, GateResult, WorkflowContext } from "../types";

export class SpecGate implements Gate {
	id = "spec";
	description = "Spec exists for command";

	async check(ctx: WorkflowContext): Promise<GateResult> {
		const specPath = join(ctx.cwd, "docs", "features", `${ctx.command}.md`);
		if (existsSync(specPath)) {
			return { ok: true };
		}
		return {
			ok: false,
			reason: `Spec missing: ${specPath}`,
			suggestions: [`Run docs generator or create ${specPath}`],
		};
	}
}
