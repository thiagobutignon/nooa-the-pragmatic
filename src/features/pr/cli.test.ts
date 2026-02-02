import { describe, expect, spyOn, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa pr", () => {
	test("pr --help shows usage", async () => {
		const { stdout } = await execa(bunPath, [binPath, "pr", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(stdout).toContain("Usage: nooa pr");
	});

	test("merge requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			bunPath,
			[binPath, "pr", "merge"],
			{
				reject: false,
				env: { ...baseEnv, GITHUB_TOKEN: "test" },
				cwd: repoRoot,
			},
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("close requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			bunPath,
			[binPath, "pr", "close"],
			{
				reject: false,
				env: { ...baseEnv, GITHUB_TOKEN: "test" },
				cwd: repoRoot,
			},
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("comment requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			bunPath,
			[binPath, "pr", "comment"],
			{
				reject: false,
				env: { ...baseEnv, GITHUB_TOKEN: "test" },
				cwd: repoRoot,
			},
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("status requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			bunPath,
			[binPath, "pr", "status"],
			{
				reject: false,
				env: { ...baseEnv, GITHUB_TOKEN: "test" },
				cwd: repoRoot,
			},
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("merge uses gh and validates pr number", async () => {
		const { ghMergePr } = await import("./gh");
		const mergeSpy = spyOn({ ghMergePr }, "ghMergePr");

		const { stderr, exitCode } = await execa(
			bunPath,
			[binPath, "pr", "merge"],
			{ reject: false, env: baseEnv, cwd: repoRoot },
		);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
		expect(mergeSpy).not.toHaveBeenCalled();
	});

	test("status uses gh and validates pr number", async () => {
		const { ghStatusPr } = await import("./gh");
		const statusSpy = spyOn({ ghStatusPr }, "ghStatusPr");

		const { stderr, exitCode } = await execa(
			bunPath,
			[binPath, "pr", "status"],
			{ reject: false, env: baseEnv, cwd: repoRoot },
		);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
		expect(statusSpy).not.toHaveBeenCalled();
	});
});
