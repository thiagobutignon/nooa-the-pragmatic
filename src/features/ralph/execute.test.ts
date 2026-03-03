import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import {
	getRalphStatus,
	initializeRalphRun,
	type RalphStatusResult,
} from "./execute";
import { getRalphPrdPath } from "./prd";
import { getRalphStateLockPath, getRalphStatePath } from "./state";

async function createTempRepo(gitignore = "") {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-exec-"));
	await execa("git", ["init"], { cwd: root });
	await execa("git", ["branch", "-m", "main"], { cwd: root });
	await writeFile(join(root, ".gitignore"), gitignore);
	await writeFile(join(root, "README.md"), "ralph test\n");
	await execa("git", ["add", "."], { cwd: root });
	await execa(
		"git",
		[
			"-c",
			"user.email=test@example.com",
			"-c",
			"user.name=test",
			"commit",
			"-m",
			"init",
		],
		{ cwd: root },
	);
	return root;
}

describe("ralph execute", () => {
	it("returns a clear no-run status when state is missing", async () => {
		const root = await createTempRepo(".nooa/ralph/\n");
		try {
			const result = await getRalphStatus({ root });
			const status = result as RalphStatusResult;

			expect(status.mode).toBe("status");
			expect(status.initialized).toBe(false);
			expect(status.runId).toBeNull();
			expect(status.storyCounts.pending).toBe(0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("refuses init when .nooa/ralph is not git-ignored", async () => {
		const root = await createTempRepo("");
		try {
			await expect(
				initializeRalphRun({
					root,
					runId: "ralph-unsafe",
					branchName: "feature/unsafe",
				}),
			).rejects.toThrow(".nooa/ralph/ must be git-ignored before init");
			expect(existsSync(getRalphStatePath(root))).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("initializes state, default prd, and clears stale locks", async () => {
		const root = await createTempRepo(".nooa/ralph/\n");
		try {
			await mkdir(join(root, ".nooa", "ralph"), { recursive: true });
			await writeFile(getRalphStateLockPath(root), "stale");

			const result = await initializeRalphRun({
				root,
				runId: "ralph-auth",
				branchName: "feature/ralph-auth",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
				workerTimeoutMs: 300000,
				reviewerTimeoutMs: 120000,
			});

			expect(result.mode).toBe("init");
			expect(result.initialized).toBe(true);
			expect(result.runId).toBe("ralph-auth");
			expect(result.branchName).toBe("feature/ralph-auth");
			expect(result.ignoredBy).toBe(".nooa/ralph/");
			expect(existsSync(getRalphStatePath(root))).toBe(true);
			expect(existsSync(getRalphPrdPath(root))).toBe(true);
			expect(existsSync(getRalphStateLockPath(root))).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
