import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa push", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "push", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa push [remote] [branch]");
		expect(res.stdout).toContain("Flags:");
		expect(res.stdout).toContain("-h, --help");
		expect(res.stdout).toContain("--no-test");
	});

	it("fails when working tree is dirty", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-push-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await writeFile(join(root, "file.txt"), "dirty\n");
			const res = await execa("bun", [binPath, "push"], {
				cwd: root,
				reject: false,
				env: { ...process.env, PWD: root, NOOA_CWD: root },
			});
			expect(res.exitCode).toBe(2);
			expect(res.stderr).toContain("Uncommitted changes");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("pushes to remote", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-push-"));
		const bare = await mkdtemp(join(tmpdir(), "nooa-push-remote-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await execa("git", ["init", "--bare"], { cwd: bare });
			await execa("git", ["remote", "add", "origin", bare], { cwd: root });
			await writeFile(join(root, "file.txt"), "hello\n");
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
				[binPath, "push", "origin", "main", "--no-test"],
				{
					cwd: root,
					reject: false,
					env: { ...process.env, PWD: root, NOOA_CWD: root },
				},
			);

			expect(res.exitCode).toBe(0);
			const ref = await execa(
				"git",
				["--git-dir", bare, "rev-parse", "refs/heads/main"],
				{ reject: false },
			);
			expect(ref.exitCode).toBe(0);
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(bare, { recursive: true, force: true });
		}
	});
});
