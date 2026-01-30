import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("worktree output", () => {
	it("writes summary to stderr and keeps stdout empty", async () => {
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

			const res = await execa(
				"bun",
				[binPath, "worktree", "feat/output", "--no-install", "--no-test"],
				{ cwd: root, reject: false },
			);

			expect(res.exitCode).toBe(0);
			expect(res.stdout).toBe("");
			expect(res.stderr).toContain("Worktree created");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
