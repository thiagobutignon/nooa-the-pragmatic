import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

describe("fix CLI", () => {
	it("should show help", async () => {
		const { stdout } = await execa(bunPath, ["index.ts", "fix", "--help"], {
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(stdout).toContain("Usage:");
	});

	it("should output JSON", async () => {
		const { stdout } = await execa(
			bunPath,
			["index.ts", "fix", "test issue", "--json", "--dry-run"],
			{
				env: { ...baseEnv, NOOA_AI_PROVIDER: "mock" },
				cwd: repoRoot,
			},
		);
		const output = JSON.parse(stdout);
		expect(output.ok).toBe(true);
		expect(output.traceId).toBeTruthy();
	});
});
