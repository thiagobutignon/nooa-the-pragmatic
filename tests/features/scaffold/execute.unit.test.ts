import { describe, expect, it, mock, beforeEach } from "bun:test";
import { executeScaffold } from "../../../src/features/scaffold/execute";
import type { ScaffoldEngine } from "../../../src/features/scaffold/engine";

describe("executeScaffold", () => {
    let mockEngine: any;

    beforeEach(() => {
        mockEngine = {
            validateName: mock(() => { }),
            renderTemplate: mock(async () => "mock content"),
            write: mock(async () => { }),
        };
    });

    it("should execute command scaffold", async () => {
        const result = await executeScaffold({
            type: "command",
            name: "my-feature",
        }, undefined, mockEngine);

        expect(mockEngine.validateName).toHaveBeenCalledWith("my-feature");
        expect(mockEngine.renderTemplate).toHaveBeenCalled();
        expect(mockEngine.write).toHaveBeenCalled();
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.traceId).toBeDefined();
    });

    it("should execute prompt scaffold", async () => {
        const result = await executeScaffold({
            type: "prompt",
            name: "my-prompt",
        }, undefined, mockEngine);

        expect(mockEngine.validateName).toHaveBeenCalledWith("my-prompt");
        expect(mockEngine.write).toHaveBeenCalledTimes(1);
        expect(result.results[0]).toContain("my-prompt.md");
    });

    it("should handle dry run", async () => {
        const result = await executeScaffold({
            type: "command",
            name: "dry-run-test",
            dryRun: true
        }, undefined, mockEngine);

        expect(mockEngine.write).toHaveBeenCalled();
        const writeCall = mockEngine.write.mock.calls[0];
        expect(writeCall[2]).toEqual({ force: undefined, dryRun: true });
    });

    it("should handle withDocs option", async () => {
        await executeScaffold({
            type: "command",
            name: "doc-test",
            withDocs: true
        }, undefined, mockEngine);

        expect(mockEngine.write).toHaveBeenCalledTimes(3);
    });

    it("should propagate errors from engine", async () => {
        mockEngine.validateName.mockImplementationOnce(() => {
            throw new Error("Invalid name");
        });

        expect(executeScaffold({ type: "command", name: "bad name" }, undefined, mockEngine))
            .rejects.toThrow("Invalid name");
    });
});
