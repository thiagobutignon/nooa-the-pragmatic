import { describe, expect, it, mock } from "bun:test";
import { EventBus } from "../../src/core/event-bus";
import actCommand from "../../src/features/act/cli";

describe("Integration: Act Events", () => {
    it("should emit act.started and act.completed events", async () => {
        const previousMockContent = process.env.NOOA_AI_MOCK_CONTENT;
        process.env.NOOA_AI_MOCK_CONTENT = JSON.stringify({
            thought: "Plan complete",
            command: null,
            done: true,
            answer: "ok",
        });

        const bus = new EventBus();
        const emitSpy = mock((event: string, payload: any) => { });
        // We can't spy on bus.emit directly if it's not a method call we control easily from outside in the same way,
        // but we can overwrite the emit method or listen.
        // Better: bind a listener to '*' if supported, or just overwrite emit.
        bus.emit = emitSpy as any;

        // Mock internal engine to avoid actual AI calls?
        // For this integration test, we might want to mock the Engine or just let it fail fast/mock the provider.
        // actCommand uses 'mock' provider by default if configured? We can pass provider: 'mock'.

        await actCommand.execute({
            args: ["act", "test goal", "--provider", "mock", "--turns", "1"],
            values: { provider: "mock", turns: "1" },
            rawArgs: ["act", "test goal", "--provider", "mock", "--turns", "1"],
            bus
        });

        if (previousMockContent === undefined) {
            delete process.env.NOOA_AI_MOCK_CONTENT;
        } else {
            process.env.NOOA_AI_MOCK_CONTENT = previousMockContent;
        }

        // Check for act.started
        expect(emitSpy).toHaveBeenCalledWith(
            "act.started",
            expect.objectContaining({
                goal: "test goal",
                traceId: expect.any(String),
            })
        );

        // Check for act.completed
        // Note: The command currently might just log to console, but we expect it to emit event eventually.
        expect(emitSpy).toHaveBeenCalledWith(
            "act.completed",
            expect.objectContaining({
                traceId: expect.any(String),
            })
        );
    });
});
