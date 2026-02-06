import { describe, expect, it } from "bun:test";
import type { TelemetryRow } from "../core/telemetry";
import { reconstituteState } from "./shared/state";

describe("DashboardView state", () => {
	it("reconstitutes workers from workflow events", () => {
		const rows: TelemetryRow[] = [
			{
				id: 1,
				timestamp: 1,
				event: "workflow.started",
				level: "info",
				duration_ms: null,
				metadata: JSON.stringify({ goal: "Ship it" }),
				trace_id: "t1",
				success: 1,
			},
			{
				id: 2,
				timestamp: 2,
				event: "workflow.step.start",
				level: "info",
				duration_ms: null,
				metadata: JSON.stringify({ stepId: "spec" }),
				trace_id: "t1",
				success: 1,
			},
			{
				id: 3,
				timestamp: 3,
				event: "workflow.gate.pass",
				level: "info",
				duration_ms: null,
				metadata: JSON.stringify({ gateId: "spec" }),
				trace_id: "t1",
				success: 1,
			},
			{
				id: 4,
				timestamp: 4,
				event: "workflow.completed",
				level: "info",
				duration_ms: null,
				metadata: null,
				trace_id: "t1",
				success: 1,
			},
		];

		const workers = reconstituteState(rows);
		expect(workers.length).toBe(1);
		expect(workers[0]?.goal).toBe("Ship it");
		expect(workers[0]?.currentStep).toBe("spec");
		expect(workers[0]?.lastGate?.id).toBe("spec");
		expect(workers[0]?.lastGate?.status).toBe("pass");
		expect(workers[0]?.gates).toContain("spec");
		expect(workers[0]?.status).toBe("completed");
	});
});
