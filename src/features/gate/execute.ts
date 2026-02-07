import type { EventBus } from "../../core/event-bus";
import { createTraceId } from "../../core/logger";
import { type SdkResult, sdkError } from "../../core/types";
import { DogfoodGate, SpecGate, TestGate } from "../../core/workflow/gates";
import type { Gate, WorkflowContext } from "../../core/workflow/types";

export interface GateCheckInput {
	id: string;
	target?: string;
	cwd?: string;
	bus?: EventBus;
	traceId?: string;
}

export interface GateCheckResult {
	ok: boolean;
	gateId: string;
	reason?: string;
	suggestions?: string[];
}

const GATES: Record<string, new () => Gate> = {
	spec: SpecGate,
	test: TestGate,
	dogfood: DogfoodGate,
};

export async function checkGate(
	input: GateCheckInput,
): Promise<SdkResult<GateCheckResult>> {
	const GateClass = GATES[input.id];
	if (!GateClass) {
		return {
			ok: false,
			error: sdkError("gate.unknown_gate", `Unknown gate ID: ${input.id}`),
		};
	}

	const gate = new GateClass();
	const ctx: WorkflowContext = {
		traceId: input.traceId || createTraceId(),
		command: "gate",
		args: { target: input.target },
		cwd: input.cwd || process.cwd(),
	};

	const result = await gate.check(ctx);

	if (!result.ok) {
		return {
			ok: true,
			data: {
				ok: false,
				gateId: gate.id,
				reason: result.reason,
				suggestions: result.suggestions,
			},
		};
	}

	return {
		ok: true,
		data: {
			ok: true,
			gateId: gate.id,
		},
	};
}
