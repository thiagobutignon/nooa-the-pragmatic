import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa worktree", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "worktree", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa worktree");
		expect(res.stdout).toContain("--base");
		expect(res.stdout).toContain("--no-test");
	});

	it("creates a worktree under .worktrees/<branch>", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
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

			const res = await execa("bun", [binPath, "worktree", "feat/test"], {
				cwd: root,
				reject: false,
				env: { ...process.env, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" },
			});

			expect(res.exitCode).toBe(0);
			expect(existsSync(join(root, ".worktrees", "feat/test"))).toBe(true);
			const list = await execa("git", ["worktree", "list"], { cwd: root });
			expect(list.stdout).toContain("feat/test");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
