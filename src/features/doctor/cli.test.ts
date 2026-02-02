import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

describe("doctor CLI", () => {
	it("should show help", async () => {
		const { stdout } = await execa(bunPath, ["index.ts", "doctor", "--help"], {
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("--json");
	});

	it("should output JSON with correct schema", async () => {
		const { stdout } = await execa(bunPath, ["index.ts", "doctor", "--json"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		const output = JSON.parse(stdout);
		expect(output.schemaVersion).toBe("1.0");
		expect(output.command).toBe("doctor");
		expect(output).toHaveProperty("ok");
		expect(output).toHaveProperty("tools");
		expect(output.tools).toHaveProperty("bun");
		expect(output.tools).toHaveProperty("git");
	}, 30000); // 30s timeout
});
