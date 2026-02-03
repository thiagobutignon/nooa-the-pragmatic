import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { execa } from "execa";


describe("sdk.push", () => {
	it("pushes to a local bare repo", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-push-"));
		const bare = await mkdtemp(join(tmpdir(), "nooa-bare-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["config", "user.email", "test@example.com"], { cwd: root });
			await execa("git", ["config", "user.name", "test"], { cwd: root });
			await writeFile(join(root, "README.md"), "hello\n");
			await execa("git", ["add", "."], { cwd: root });
			await execa("git", ["commit", "-m", "init"], { cwd: root });

			await execa("git", ["init", "--bare"], { cwd: bare });
			await execa("git", ["remote", "add", "origin", bare], { cwd: root });

			const { sdk } = await import("./index");
			const result = await sdk.push.run({ cwd: root, noTest: true });
			expect(result.ok).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(bare, { recursive: true, force: true });
		}
	});
});
