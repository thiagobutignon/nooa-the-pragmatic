import { describe, expect, it } from "bun:test";
import { execa } from "execa";

describe("ci CLI", () => {
    it("should show help", async () => {
        const { stdout } = await execa("bun", ["index.ts", "ci", "--help"]);
        expect(stdout).toContain("Usage:");
    });

    it("should output JSON", async () => {
        const { stdout } = await execa("bun", ["index.ts", "ci", "--json"], {
            env: { ...process.env, NOOA_AI_PROVIDER: "mock" }
        });
        const output = JSON.parse(stdout);
        expect(output.command).toBe("ci");
        expect(output.ok).toBe(true);
    });
});
