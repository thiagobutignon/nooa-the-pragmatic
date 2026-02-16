import { describe, expect, it, mock, spyOn } from "bun:test";
import {
    run,
    parseWorkflowInput,
    handleWorkflowSuccess
} from "../../../src/features/workflow/cli";

// No more mock.module which leaks!
// mock.module("../../../src/features/workflow/execute", ...);

describe("workflow CLI unit tests", () => {
    describe("parseWorkflowInput", () => {
        // ... same tests ...
        it("should parse run action correctly", async () => {
            const result = await parseWorkflowInput({
                positionals: ["workflow", "run"],
                values: { gates: "spec,test", target: "foo", json: true },
                bus: {},
                traceId: "123"
            });

            expect(result.action).toBe("run");
            expect(result.gates).toBe("spec,test");
            expect(result.target).toBe("foo");
            expect(result.json).toBe(true);
        });

        it("should handle missing optional args", async () => {
            const result = await parseWorkflowInput({
                positionals: ["workflow"],
                values: {},
            });
            expect(result.action).toBeUndefined();
            expect(result.gates).toBeUndefined();
        });
    });

    describe("handleWorkflowSuccess", () => {
        // ... same tests ...
        it("should print JSON if json flag is true", () => {
            const logSpy = spyOn(console, "log").mockImplementation(() => { });
            handleWorkflowSuccess({ ok: true }, { json: true });
            expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
            logSpy.mockRestore();
        });

        it("should print help if help step failed (help mode)", () => {
            const logSpy = spyOn(console, "log").mockImplementation(() => { });
            handleWorkflowSuccess({ failedStepId: "help", reason: "help text" }, {});
            expect(logSpy).toHaveBeenCalledWith("help text");
            logSpy.mockRestore();
        });

        it("should print success message if ok", () => {
            const errorSpy = spyOn(console, "error").mockImplementation(() => { });
            handleWorkflowSuccess({ ok: true }, {});
            expect(errorSpy).toHaveBeenCalledWith("✅ Workflow passed.");
            errorSpy.mockRestore();
        });

        it("should print failure message and set exit code if not ok", () => {
            const errorSpy = spyOn(console, "error").mockImplementation(() => { });
            const originalExitCode = process.exitCode;

            handleWorkflowSuccess({ ok: false, failedStepId: "step1", reason: "bad" }, {});

            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Workflow failed at step: step1"));
            expect(process.exitCode).toBe(1);

            errorSpy.mockRestore();
            process.exitCode = originalExitCode;
        });
    });

    describe("run", () => {
        it("should call injected runner with parsed args", async () => {
            const mockRunner = mock(async (args) => ({ ok: true, data: { ok: true } }));

            // Pass mock runner
            const result = await run({ action: "run", gates: "spec,test" }, mockRunner as any);

            expect(result.ok).toBe(true);
            expect(mockRunner).toHaveBeenCalled();
            expect(mockRunner.mock.calls[0][0]).toMatchObject({ gates: ["spec", "test"] });
        });

        it("should return help if action is not run", async () => {
            const result = await run({}); // uses default runner but logic returns early so it's safe
            expect(result.ok).toBe(true);
            expect(result.data?.failedStepId).toBe("help");
        });
    });
});
