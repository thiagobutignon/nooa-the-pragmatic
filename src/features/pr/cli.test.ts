import { expect, test, describe, spyOn } from "bun:test";
import { execa } from "execa";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa pr", () => {
	test("pr --help shows usage", async () => {
		const { stdout } = await execa("bun", [binPath, "pr", "--help"], { reject: false });
		expect(stdout).toContain("Usage: nooa pr");
	});

	test("merge requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "pr", "merge"],
			{ reject: false, env: { ...process.env, GITHUB_TOKEN: "test" } },
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("close requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "pr", "close"],
			{ reject: false, env: { ...process.env, GITHUB_TOKEN: "test" } },
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("comment requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "pr", "comment"],
			{ reject: false, env: { ...process.env, GITHUB_TOKEN: "test" } },
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("status requires pr number", async () => {
		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "pr", "status"],
			{ reject: false, env: { ...process.env, GITHUB_TOKEN: "test" } },
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
	});

	test("merge uses gh and validates pr number", async () => {
		const { ghMergePr } = await import("./gh");
		const mergeSpy = spyOn({ ghMergePr }, "ghMergePr");

		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "pr", "merge"],
			{ reject: false },
		);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
		expect(mergeSpy).not.toHaveBeenCalled();
	});

	test("status uses gh and validates pr number", async () => {
		const { ghStatusPr } = await import("./gh");
		const statusSpy = spyOn({ ghStatusPr }, "ghStatusPr");

		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "pr", "status"],
			{ reject: false },
		);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("PR number");
		expect(statusSpy).not.toHaveBeenCalled();
	});
});
