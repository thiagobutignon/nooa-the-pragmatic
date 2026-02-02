import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa worktree", () => {
	it("shows help", async () => {
		const res = await execa(bunPath, [binPath, "worktree", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
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

			const res = await execa(bunPath, [binPath, "worktree", "feat/test"], {
				cwd: root,
				reject: false,
				env: { ...baseEnv, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" },
			});

			expect(res.exitCode).toBe(0);
			expect(existsSync(join(root, ".worktrees", "feat/test"))).toBe(true);
			const list = await execa("git", ["worktree", "list"], { cwd: root });
			expect(list.stdout).toContain("feat/test");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("respects --no-install and --no-test", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await writeFile(join(root, ".gitignore"), ".worktrees\n");
			await writeFile(
				join(root, "package.json"),
				JSON.stringify({ name: "tmp", version: "0.0.0" }),
			);
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
				bunPath,
				[binPath, "worktree", "feat/skip", "--no-install", "--no-test"],
				{ cwd: root, reject: false, env: baseEnv },
			);

			expect(res.exitCode).toBe(0);
			expect(
				existsSync(join(root, ".worktrees", "feat/skip", "node_modules")),
			).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("installs deps and runs tests by default", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await writeFile(join(root, ".gitignore"), ".worktrees\n");
			await writeFile(
				join(root, "package.json"),
				JSON.stringify({ name: "tmp", version: "0.0.0" }),
			);
			await writeFile(
				join(root, "example.test.ts"),
				`import { writeFileSync } from "node:fs";
import { test, expect } from "bun:test";

test("marker", () => {
\twriteFileSync("test-ran.txt", "ok");
\texpect(true).toBe(true);
});
`,
			);
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

			const res = await execa(bunPath, [binPath, "worktree", "feat/defaults"], {
				cwd: root,
				reject: false,
				env: baseEnv,
			});

			expect(res.exitCode).toBe(0);
			expect(
				existsSync(join(root, ".worktrees", "feat/defaults", "node_modules")),
			).toBe(true);
			expect(
				existsSync(join(root, ".worktrees", "feat/defaults", "test-ran.txt")),
			).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
