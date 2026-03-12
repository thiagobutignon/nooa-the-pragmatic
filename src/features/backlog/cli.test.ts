import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa backlog", () => {
	it("shows subcommand help contract", async () => {
		const res = await execa(bunPath, [binPath, "backlog", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});

		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa backlog");
		expect(res.stdout).toContain("generate");
		expect(res.stdout).toContain("validate");
		expect(res.stdout).toContain("split");
		expect(res.stdout).toContain("board");
		expect(res.stdout).toContain("move");
		expect(res.stdout).toContain("profile-command");
	});
});
