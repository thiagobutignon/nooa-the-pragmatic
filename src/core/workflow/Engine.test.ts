import { describe, expect, it } from "bun:test";
import { WorkflowEngine } from "./Engine";
import { SpecGate } from "./gates/SpecGate";

describe("WorkflowEngine", () => {
	it("fails when spec is missing", async () => {
		const engine = new WorkflowEngine();
		const result = await engine.run(
			[{ id: "spec", gate: new SpecGate(), action: async () => null }],
			{
				traceId: "t",
				command: "missing-spec-command",
				args: {},
				cwd: process.cwd(),
			},
		);
		expect(result.ok).toBe(false);
		expect(result.failedStepId).toBe("spec");
		expect(result.reason).toContain("Spec missing");
	});

	it("runs actions when gate passes", async () => {
		const engine = new WorkflowEngine();
		let ran = false;
		const step = {
			id: "ok",
			gate: {
				id: "ok-gate",
				description: "always ok",
				check: async () => ({ ok: true as const }),
			},
			action: async () => {
				ran = true;
			},
		};
		const result = await engine.run([step], {
			traceId: "t",
			command: "read",
			args: {},
			cwd: process.cwd(),
		});
		expect(result.ok).toBe(true);
		expect(ran).toBe(true);
	});
});
