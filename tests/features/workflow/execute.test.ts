import { describe, expect, it } from "bun:test";
import { EventBus } from "../../../src/core/event-bus";
import { runWorkflow } from "../../../src/features/workflow/execute";
import type { Gate, GateResult, WorkflowContext } from "../../../src/core/workflow/types";

// Mock Gates
class MockSpecGate implements Gate {
    id = "spec";
    description = "Mock Spec";
    async check(_ctx: WorkflowContext): Promise<GateResult> {
        return { ok: true };
    }
}

class MockTestGate implements Gate {
    id = "test";
    description = "Mock Test";
    async check(_ctx: WorkflowContext): Promise<GateResult> {
        return { ok: true };
    }
}

class MockDogfoodGate implements Gate {
    id = "dogfood";
    description = "Mock Dogfood";
    async check(_ctx: WorkflowContext): Promise<GateResult> {
        return { ok: true };
    }
}

const mockGates = {
    spec: MockSpecGate,
    test: MockTestGate,
    dogfood: MockDogfoodGate,
};

describe("runWorkflow", () => {
    it("should run default gates (spec, test, dogfood) when no gates provided", async () => {
        const result = await runWorkflow({}, mockGates);
        expect(result.ok).toBe(true);
        expect(result.data?.ok).toBe(true);
    });

    it("should run specified gates", async () => {
        const result = await runWorkflow({ gates: ["spec"] }, mockGates);
        expect(result.ok).toBe(true);
        expect(result.data?.ok).toBe(true);
    });

    it("should fail gracefully on unknown gate", async () => {
        const result = await runWorkflow({ gates: ["unknown-gate"] }, mockGates);
        expect(result.ok).toBe(false);
        expect(result.error?.code).toBe("workflow.unknown_gate");
    });

    it("should emit workflow events if bus is provided", async () => {
        const bus = new EventBus();
        const events: string[] = [];
        bus.on("workflow.started", () => events.push("start"));
        bus.on("workflow.completed", () => events.push("complete"));

        await runWorkflow({ bus }, mockGates);

        expect(events).toContain("start");
        expect(events).toContain("complete");
    });

    it("should return failure if a gate fails", async () => {
        class FailingGate implements Gate {
            id = "fail";
            description = "Fails";
            async check(): Promise<GateResult> {
                return { ok: false, reason: "failed" };
            }
        }

        const result = await runWorkflow(
            { gates: ["fail"] },
            { fail: FailingGate }
        );

        expect(result.ok).toBe(true); // runWorkflow returns ok even if step fails (it returns result in data)
        expect(result.data?.ok).toBe(false);
        expect(result.data?.reason).toBe("failed");
    });
});
