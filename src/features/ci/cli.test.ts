import { describe, expect, it } from "bun:test";
import { execa } from "execa";

describe("ci CLI", () => {
	it("should show help", async () => {
		const { stdout } = await execa("bun", ["index.ts", "ci", "--help"]);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("--json");
	});

	it("should output JSON with correct schema", async () => {
		const { stdout } = await execa("bun", ["index.ts", "ci", "--json"], {
			env: {
				...process.env,
				NOOA_AI_PROVIDER: "mock",
				NOOA_SKIP_CI_RECURSION: "1",
			},
			timeout: 60000, // 60s timeout
		});
		const output = JSON.parse(stdout);
		expect(output.schemaVersion).toBe("1.0");
		expect(output.command).toBe("ci");
		expect(output).toHaveProperty("ok");
		expect(output).toHaveProperty("stages");
	}, 60000);
});
