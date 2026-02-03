import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { execa } from "execa";


describe("sdk.worktree", () => {
	it("creates and removes a worktree", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
		try {
			await execa("git", ["init", "-b", "main"], { cwd: root });
			await execa("git", ["config", "user.email", "test@example.com"], {
				cwd: root,
			});
			await execa("git", ["config", "user.name", "test"], { cwd: root });
			await writeFile(join(root, "README.md"), "hello\n");
			await execa("git", ["add", "."], { cwd: root });
			await execa("git", ["commit", "-m", "init"], { cwd: root });

			const { sdk } = await import("./index");
			const created = await sdk.worktree.create({
				branch: "feature-test",
				base: "main",
				noInstall: true,
				noTest: true,
				cwd: root,
			});
			expect(created.ok).toBe(true);
			if (created.ok) {
				expect(existsSync(created.data.path)).toBe(true);
			}

		const list = await sdk.worktree.list({ cwd: root });
		expect(list.ok).toBe(true);
		if (list.ok) {
			const entry = list.data.entries.find(
				(item) => item.branch === "feature-test",
			);
			expect(entry).toBeTruthy();
		}

		const info = await sdk.worktree.info({ branch: "feature-test", cwd: root });
		expect(info.ok).toBe(true);
		if (info.ok) {
			expect(info.data.entry.branch).toBe("feature-test");
		}

			const removed = await sdk.worktree.remove({ branch: "feature-test", cwd: root });
			expect(removed.ok).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
