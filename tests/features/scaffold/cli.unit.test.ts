import { describe, expect, it, mock, spyOn, beforeEach, afterEach } from "bun:test";
import {
    run,
    parseScaffoldInput,
    handleScaffoldSuccess,
    handleScaffoldFailure
} from "../../../src/features/scaffold/cli";

// Mock execute
const mockExecuteScaffold = mock(async () => ({ results: ["file.ts"], traceId: "t1" }));

mock.module("../../../src/features/scaffold/execute", () => ({
    executeScaffold: mockExecuteScaffold
}));

describe("scaffold CLI", () => {
    beforeEach(() => {
        mockExecuteScaffold.mockClear();
    });

    describe("parseScaffoldInput", () => {
        it("should parse args", async () => {
            const result = await parseScaffoldInput({
                positionals: ["scaffold", "command", "my-feature"],
                values: { force: true, json: true }
            });
            expect(result.type).toBe("command");
            expect(result.name).toBe("my-feature");
            expect(result.force).toBe(true);
            expect(result.json).toBe(true);
        });
    });

    describe("run", () => {
        it("should validate missing args", async () => {
            const result = await run({});
            expect(result.ok).toBe(false);
            expect(result.error?.code).toBe("scaffold.invalid_args");
        });

        it("should validate type", async () => {
            const result = await run({ type: "invalid" as any, name: "foo" });
            expect(result.ok).toBe(false);
            expect(result.error?.code).toBe("scaffold.invalid_type");
        });

        it("should execute success", async () => {
            const result = await run({ type: "command", name: "foo" });
            expect(result.ok).toBe(true);
            expect(result.data?.files).toEqual(["file.ts"]);
        });

        it("should handle already exists", async () => {
            mockExecuteScaffold.mockRejectedValueOnce(new Error("already exists"));
            const result = await run({ type: "command", name: "foo" });
            expect(result.ok).toBe(false);
            expect(result.error?.code).toBe("scaffold.already_exists");
        });

        it("should handle validation error from execute", async () => {
            mockExecuteScaffold.mockRejectedValueOnce(new Error("Invalid name"));
            const result = await run({ type: "command", name: "foo" });
            expect(result.ok).toBe(false);
            expect(result.error?.code).toBe("scaffold.invalid_name");
        });

        it("should handle random error", async () => {
            mockExecuteScaffold.mockRejectedValueOnce(new Error("boom"));
            const result = await run({ type: "command", name: "foo" });
            expect(result.ok).toBe(false);
            expect(result.error?.code).toBe("scaffold.runtime_error");
        });
    });

    describe("handleScaffoldSuccess", () => {
        let logSpy: any;

        beforeEach(() => {
            logSpy = spyOn(console, "log").mockImplementation(() => { });
        });

        afterEach(() => {
            logSpy.mockRestore();
        });

        it("should output standard success for command", async () => {
            await handleScaffoldSuccess({
                traceId: "t1", kind: "command", name: "foo", files: ["f"], dryRun: false
            }, {});
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Scaffold success"));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Run tests"));
        });

        it("should output standard success for prompt", async () => {
            await handleScaffoldSuccess({
                traceId: "t1", kind: "prompt", name: "bar", files: ["p.md"], dryRun: false
            }, {});
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Validate prompt"));
        });

        it("should output dry run message", async () => {
            await handleScaffoldSuccess({
                traceId: "t1", kind: "command", name: "foo", files: [], dryRun: true
            }, {});
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DRY RUN"));
            expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("Next Steps"));
        });

        it("should output json success", async () => {
            // We can't easily mock renderJsonOrWrite if we didn't export it/mock it. 
            // But we can check if it finishes without error.
            await handleScaffoldSuccess({
                traceId: "t1", kind: "command", name: "foo", files: ["f"], dryRun: false
            }, { json: true });
        });
    });

    describe("handleScaffoldFailure", () => {
        let errorSpy: any;

        beforeEach(() => {
            errorSpy = spyOn(console, "error").mockImplementation(() => { });
        });

        afterEach(() => {
            errorSpy.mockRestore();
        });

        it("should log invalid name error", async () => {
            await handleScaffoldFailure({ code: "scaffold.invalid_name", message: "bad name" }, { json: false });
            expect(errorSpy).toHaveBeenCalledWith("❌ Validation Error: bad name");
        });

        it("should log runtime error", async () => {
            await handleScaffoldFailure({ code: "scaffold.runtime_error", message: "oops" }, { json: false });
            expect(errorSpy).toHaveBeenCalledWith("❌ Runtime Error: oops");
        });

        it("should handle json error", async () => {
            // Should not console.error, but write json (or fail silently if we don't mock it)
            await handleScaffoldFailure({ code: "scaffold.runtime_error", message: "oops" }, { json: true });
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });
});
