import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { WorktreePool } from "./Pool";

async function initRepo(root: string) {
	await execa("git", ["init"], { cwd: root });
	await execa("git", ["branch", "-m", "main"], { cwd: root });
	await writeFile(join(root, ".gitignore"), ".worktrees\n");
	await writeFile(join(root, "README.md"), "hello\n");
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
}

describe("WorktreePool", () => {
	it("acquires and releases worktrees", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-pool-"));
		try {
			await initRepo(root);
			const pool = new WorktreePool({ maxWorktrees: 1, root });
			const wt = await pool.acquire("feat/pool-test");
			expect(wt.path).toContain(".worktrees");
			expect(existsSync(wt.path)).toBe(true);
			await pool.release(wt);
			expect(existsSync(wt.path)).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("resolves repo root when not provided", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-pool-root-"));
		const previousCwd = process.cwd();
		try {
			await initRepo(root);
			process.chdir(root);
			const pool = new WorktreePool({ maxWorktrees: 1 });
			const wt = await pool.acquire("feat/pool-auto");
			const expectedRoot = await realpath(root);
			const actualRoot = await realpath(wt.root);
			expect(actualRoot).toBe(expectedRoot);
			await pool.release(wt);
		} finally {
			process.chdir(previousCwd);
			await rm(root, { recursive: true, force: true });
		}
	});

	it("enforces max worktree limit and lists active handles", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-pool-limit-"));
		try {
			await initRepo(root);
			const pool = new WorktreePool({ maxWorktrees: 1, root });
			const wt = await pool.acquire("feat/pool-limit");
			expect(pool.list()).toHaveLength(1);
			await expect(pool.acquire("feat/pool-limit-2")).rejects.toThrow(
				"POOL_EXHAUSTED",
			);
			await pool.release(wt);
			expect(pool.list()).toHaveLength(0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
