import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

async function initRepo(root: string, extra: Record<string, string> = {}) {
	await execa("git", ["init"], { cwd: root });
	await execa("git", ["branch", "-m", "main"], { cwd: root });
	await writeFile(join(root, ".gitignore"), ".worktrees\n");
	for (const [file, content] of Object.entries(extra)) {
		await writeFile(join(root, file), content);
	}
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
				env: { ...baseEnv, NOOA_SKIP_INSTALL: "0", NOOA_SKIP_TEST: "0" },
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

	it("lists worktrees with list subcommand", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await initRepo(root);
			const env = { ...baseEnv, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" };
			await execa(bunPath, [binPath, "worktree", "feat/list"], {
				cwd: root,
				reject: false,
				env,
			});

			const list = await execa(bunPath, [binPath, "worktree", "list"], {
				cwd: root,
				reject: false,
				env,
			});
			expect(list.exitCode).toBe(0);
			expect(list.stdout).toContain(".worktrees/feat/list");

			const json = await execa(
				bunPath,
				[binPath, "worktree", "list", "--json"],
				{ cwd: root, reject: false, env },
			);
			const parsed = JSON.parse(json.stdout) as {
				worktrees: Array<{ branch?: string }>;
			};
			expect(Array.isArray(parsed.worktrees)).toBe(true);
			const branchEntry = parsed.worktrees.find(
				(entry) => entry.branch === "feat/list",
			);
			expect(branchEntry).toBeDefined();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("reports worktree info from info subcommand", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await initRepo(root);
			const env = { ...baseEnv, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" };
			await execa(bunPath, [binPath, "worktree", "feat/info"], {
				cwd: root,
				reject: false,
				env,
			});

			const res = await execa(
				bunPath,
				[binPath, "worktree", "info", "feat/info", "--json"],
				{ cwd: root, reject: false, env },
			);
			const parsed = JSON.parse(res.stdout);
			expect(parsed.branch).toBe("feat/info");
			expect(parsed.path).toContain(".worktrees/feat/info");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("removes worktree using remove subcommand", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await initRepo(root);
			const env = { ...baseEnv, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" };
			await execa(bunPath, [binPath, "worktree", "feat/remove"], {
				cwd: root,
				reject: false,
				env,
			});

			const res = await execa(
				bunPath,
				[binPath, "worktree", "remove", "feat/remove"],
				{ cwd: root, reject: false, env },
			);
			expect(res.exitCode).toBe(0);
			expect(existsSync(join(root, ".worktrees", "feat/remove"))).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("prunes worktrees via prune subcommand", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await initRepo(root);
			const res = await execa(bunPath, [binPath, "worktree", "prune"], {
				cwd: root,
				reject: false,
				env: baseEnv,
			});
			expect(res.exitCode).toBe(0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("locks and unlocks worktrees", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await initRepo(root);
			const env = { ...baseEnv, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" };
			await execa(bunPath, [binPath, "worktree", "feat/lock"], {
				cwd: root,
				reject: false,
				env,
			});

			const lock = await execa(
				bunPath,
				[binPath, "worktree", "lock", "feat/lock"],
				{ cwd: root, reject: false, env },
			);
			expect(lock.exitCode).toBe(0);
			const listAfterLock = await execa("git", ["worktree", "list"], {
				cwd: root,
			});
			expect(listAfterLock.stdout).toContain("locked");

			const unlock = await execa(
				bunPath,
				[binPath, "worktree", "unlock", "feat/lock"],
				{ cwd: root, reject: false, env },
			);
			expect(unlock.exitCode).toBe(0);
			const listAfterUnlock = await execa("git", ["worktree", "list"], {
				cwd: root,
			});
			expect(listAfterUnlock.stdout).not.toContain("locked");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
