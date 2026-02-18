import { EventBus } from "../../core/event-bus";
import { createTraceId } from "../../core/logger";
import { type SdkResult, sdkError } from "../../core/types";
import { WorkflowEngine } from "../../core/workflow/engine";
import { DogfoodGate, SpecGate, TestGate } from "../../core/workflow/gates";
import type {
	Gate,
	WorkflowContext,
	WorkflowStep,
} from "../../core/workflow/types";

export interface WorkflowRunInput {
	gates?: string[];
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
	target?: string;
}

export interface WorkflowRunResult {
	ok: boolean;
	failedStepId?: string;
	reason?: string;
}

// Define interface for gate constructors
type GateConstructor = new () => Gate;

const AVAILABLE_GATES: Record<string, GateConstructor> = {
	spec: SpecGate,
	test: TestGate,
	dogfood: DogfoodGate,
};

export async function runWorkflow(
	input: WorkflowRunInput,
	// Injection for testing
	gateMap: Record<string, GateConstructor> = AVAILABLE_GATES,
): Promise<SdkResult<WorkflowRunResult>> {
	const traceId = input.traceId || createTraceId();
	const engine = new WorkflowEngine();
	const ctx: WorkflowContext = {
		traceId,
		command: "workflow",
		args: { target: input.target },
		cwd: input.cwd || process.cwd(),
	};

	const requestedGates =
		input.gates && input.gates.length > 0
			? input.gates
			: ["spec", "test", "dogfood"];

	const steps: WorkflowStep[] = [];

	for (const gateId of requestedGates) {
		const GateClass = gateMap[gateId];
		if (!GateClass) {
			return {
				ok: false,
				error: sdkError("workflow.unknown_gate", `Unknown gate ID: ${gateId}`),
			};
		}
		steps.push({
			id: gateId,
			gate: {
				id: gateId,
				description: `Run ${gateId} check`,
				check: async (c) => {
					// Instantiate fresh gate for each check
					const g = new GateClass();
					return g.check(c);
				},
			},
			action: async () => { }, // No-op action for verification-only workflow
		});
	}

	if (input.bus) {
		input.bus.emit("workflow.started", {
			type: "workflow.started",
			traceId,
			goal: "Manual Verification",
		});
	}

	const result = await engine.run(steps, ctx);

	if (input.bus) {
		input.bus.emit("workflow.completed", {
			type: "workflow.completed",
			traceId,
			result: result.ok ? "success" : "failure",
		});
	}

	return {
		ok: true,
		data: {
			ok: result.ok,
			failedStepId: result.failedStepId,
			reason: result.reason,
		},
	};
}
