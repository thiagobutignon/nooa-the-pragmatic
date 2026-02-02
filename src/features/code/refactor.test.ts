import { describe, test, expect, mock, spyOn } from "bun:test";
import { describe, test, expect, mock } from "bun:test";
// import { executeRefactor } from "./refactor"; // using dynamic import

// Mock dependencies
mock.module("node:fs/promises", () => ({
    readFile: async () => "original code",
    writeFile: async () => undefined,
}));

// Mock AiEngine if complex, or just mock the instance?
// executeRefactor presumably imports a global instance or creates one.
// Let's assume it imports 'ai' from somewhere or we can mock the module that exports it.
// Assuming we use src/features/ai/engine.ts
// We'll mock the module.

const mockComplete = mock(async () => ({ content: "refactored code" }));

mock.module("../ai/engine", () => ({
    AiEngine: class MockEngine {
        complete = mockComplete;
        register = () => { };
    },
}));

describe("Code Refactor Feature", () => {
    test("executeRefactor reads, prompts AI, and writes back", async () => {
        const { executeRefactor } = await import("./refactor");
        const result = await executeRefactor("src/file.ts", "rename vars");

        expect(result).toBe("Refactored src/file.ts");
        expect(mockComplete).toHaveBeenCalled();
    });
});
