import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mockComplete = mock(async () => ({ content: "refactored code" }));

mock.module("../ai/engine", () => ({
    AiEngine: class MockEngine {
        complete = mockComplete;
        register = () => { };
    },
}));

describe("Code Refactor Feature", () => {
    let root = "";

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "nooa-refactor-"));
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    test("executeRefactor reads, prompts AI, and writes back", async () => {
        const filePath = join(root, "file.ts");
        await writeFile(filePath, "original code");

        const { executeRefactor } = await import("./refactor");
        const result = await executeRefactor(filePath, "rename vars");

        expect(result).toBe(`Refactored ${filePath}`);
        expect(mockComplete).toHaveBeenCalled();

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("refactored code");
    });
});
