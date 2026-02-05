import { describe, expect, it } from "bun:test";
import { execa } from "execa";

describe("{{name}} CLI", () => {
    it("should show help", async () => {
        const { stdout } = await execa("bun", ["index.ts", "{{name}}", "--help"]);
        expect(stdout).toContain("Usage: nooa {{name}}");
    });

    it("should output JSON", async () => {
        const { stdout } = await execa("bun", ["index.ts", "{{name}}", "hello", "--json"]);
        const output = JSON.parse(stdout);
        expect(output.ok).toBe(true);
        expect(output.traceId).toBeDefined();
        expect(output.message).toContain("hello");
    });
});
