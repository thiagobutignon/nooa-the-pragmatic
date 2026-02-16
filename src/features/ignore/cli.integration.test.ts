import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa ignore", () => {
	it("shows help with check and test", async () => {
		const res = await execa(bunPath, [binPath, "ignore", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("nooa ignore");
		expect(res.stdout).toContain("check");
		expect(res.stdout).toContain("test");
	});

	it("prints ignored result when path matches", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-ignore-"));
		try {
			await mkdir(join(root, "logs"), { recursive: true });
			await writeFile(join(root, ".nooa-ignore"), "logs/*.log\n");
			const target = join("logs", "app.log");
			await writeFile(join(root, target), "ok\n");

			const res = await execa(bunPath, [binPath, "ignore", "check", target], {
				cwd: root,
				reject: false,
				env: baseEnv,
			});

			expect(res.exitCode).toBe(0);
			expect(res.stdout).toContain("ignored");
			expect(res.stdout).toContain("logs/*.log");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("prints not ignored result when path does not match", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-ignore-"));
		try {
			await writeFile(join(root, ".nooa-ignore"), "logs/*.log\n");
			await writeFile(join(root, "README.md"), "hi\n");

			const res = await execa(
				bunPath,
				[binPath, "ignore", "check", "README.md"],
				{
					cwd: root,
					reject: false,
					env: baseEnv,
				},
			);

			expect(res.exitCode).toBe(1);
			expect(res.stdout).toContain("not ignored");
			expect(res.stdout).toContain("README.md");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("tests a new pattern against provided paths", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-ignore-"));
		try {
			await mkdir(join(root, "logs"), { recursive: true });
			await writeFile(join(root, "logs", "app.log"), "ok\n");
			await writeFile(join(root, "README.md"), "hi\n");

			const res = await execa(
				bunPath,
				[binPath, "ignore", "test", "logs/*.log", "logs/app.log", "README.md"],
				{
					cwd: root,
					reject: false,
					env: baseEnv,
				},
			);

			expect(res.exitCode).toBe(0);
			expect(res.stdout).toContain("Testing");
			expect(res.stdout).toContain("logs/app.log");
			expect(res.stdout).toContain("README.md");
			expect(res.stdout).toContain("✅");
			expect(res.stdout).toContain("❌");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("fails when test pattern matches nothing", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-ignore-"));
		try {
			await writeFile(join(root, "README.md"), "hi\n");

			const res = await execa(
				bunPath,
				[binPath, "ignore", "test", "logs/*.log", "README.md"],
				{
					cwd: root,
					reject: false,
					env: baseEnv,
				},
			);

			expect(res.exitCode).toBe(2);
			expect(res.stdout).toContain("No matches");
			expect(res.stdout).toContain("logs/*.log");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
