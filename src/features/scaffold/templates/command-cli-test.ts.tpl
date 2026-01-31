import { describe, expect, it } from "bun:test";
import { execa } from "execa";

describe("{{name}} CLI", () => {
    it("should show help", async () => {
        const { stdout } = await execa("bun", ["index.ts", "{{name}}", "--help"]);
        expect(stdout).toContain("Usage:");
    });

    it("should output JSON", async () => {
        const { stdout } = await execa("bun", ["index.ts", "{{name}}", "--json"], {
            env: { ...process.env, NOOA_AI_PROVIDER: "mock" }
        });
        const output = JSON.parse(stdout);
        expect(output.command).toBe("{{name}}");
        expect(output.ok).toBe(true);
    });
});
