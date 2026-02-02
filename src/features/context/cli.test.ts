import { describe, expect, test } from "bun:test";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

describe("context CLI", () => {
	test("outputs context for a file", async () => {
		const { stdout, exitCode } = await execa(
			bunPath,
			["index.ts", "context", "src/core/logger.ts", "--json"],
			{ reject: false, env: baseEnv, cwd: repoRoot },
		);
		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("target");
	});
});
