import type { TelemetryRow } from "../../core/telemetry";

export interface WorkerView {
	id: string; // traceId
	goal: string;
	currentStep?: string;
	lastGate?: { id: string; status: "pass" | "fail" };
	gates: string[]; // List of passed gates
	lastEventTime: number;
	status: "active" | "completed" | "failed";
}

function parseMetadata(row: TelemetryRow): Record<string, unknown> {
	if (!row.metadata) return {};
	if (typeof row.metadata === "string") {
		try {
			const parsed = JSON.parse(row.metadata);
			if (parsed && typeof parsed === "object") {
				return parsed as Record<string, unknown>;
			}
			return {};
		} catch {
			return {};
		}
	}
	if (typeof row.metadata === "object") {
		return row.metadata as Record<string, unknown>;
	}
	return {};
}

export function reconstituteState(rows: TelemetryRow[]): WorkerView[] {
	const workers = new Map<string, WorkerView>();

	// Process in chronological order
	const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);

	for (const row of sorted) {
		const traceId = row.trace_id;
		if (!traceId) continue;

		let worker = workers.get(traceId);
		const eventType = row.event ?? "";
		const metadata = parseMetadata(row);

		if (eventType === "workflow.started" || eventType === "act.started") {
			const goal = (metadata as any)?.goal || "Unknown Goal";
			worker = {
				id: traceId,
				goal,
				gates: [],
				lastEventTime: row.timestamp,
				status: "active",
			};
			workers.set(traceId, worker);
		}

		if (
			!worker &&
			(eventType.startsWith("workflow.") || eventType.startsWith("act."))
		) {
			worker = {
				id: traceId,
				goal: "Unknown (Attached)",
				gates: [],
				lastEventTime: row.timestamp,
				status: "active",
			};
			workers.set(traceId, worker);
		}

		if (!worker) continue;

		worker.lastEventTime = row.timestamp;

		if (eventType === "workflow.step.start") {
			worker.currentStep = (metadata as any)?.stepId;
		}
		if (eventType === "workflow.gate.pass") {
			const gateId = (metadata as any)?.gateId;
			worker.lastGate = { id: gateId, status: "pass" };
			if (gateId && !worker.gates.includes(gateId)) {
				worker.gates.push(gateId);
			}
		}
		if (eventType === "workflow.gate.fail") {
			worker.lastGate = { id: (metadata as any)?.gateId, status: "fail" };
			worker.status = "failed";
		}
		if (eventType === "workflow.completed" || eventType === "act.completed") {
			worker.status = "completed";
		}
	}

	return Array.from(workers.values());
}
