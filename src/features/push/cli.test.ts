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
			});
			expect(res.exitCode).toBe(2);
			expect(res.stderr).toContain("Uncommitted changes");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
