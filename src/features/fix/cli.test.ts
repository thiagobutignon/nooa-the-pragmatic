import { describe, expect, it } from "bun:test";
import { execa } from "execa";

describe("fix CLI", () => {
    it("should show help", async () => {
        const { stdout } = await execa("bun", ["index.ts", "fix", "--help"]);
        expect(stdout).toContain("Usage:");
    });

	it("should output JSON", async () => {
		const { stdout } = await execa("bun", ["index.ts", "fix", "test issue", "--json", "--dry-run"], {
			env: { ...process.env, NOOA_AI_PROVIDER: "mock" }
		});
		const output = JSON.parse(stdout);
		expect(output.ok).toBe(true);
		expect(output.traceId).toBeTruthy();
    });
});
