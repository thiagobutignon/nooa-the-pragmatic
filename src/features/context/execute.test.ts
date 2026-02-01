import { expect, test, describe } from "bun:test";
import { buildContext } from "./execute";

describe("Context Builder", () => {
    test("extracts related files for a given file", async () => {
        // We use a real file from the project to verify extraction
        const result = await buildContext("src/core/logger.ts");
        expect(result).toHaveProperty("target");
        expect(result).toHaveProperty("content");
        expect(result).toHaveProperty("related");
        expect(result).toHaveProperty("tests");
        expect(result).toHaveProperty("recentCommits");
        
        expect(result.target).toBe("src/core/logger.ts");
        expect(result.content).toContain("AsyncLocalStorage");
    });
});
