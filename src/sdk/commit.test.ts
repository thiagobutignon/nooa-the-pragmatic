import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { sdk } from "./index";


describe("sdk.commit", () => {
	it("commits staged changes", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-sdk-commit-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await execa("git", ["config", "user.email", "test@example.com"], {
				cwd: root,
			});
			await execa("git", ["config", "user.name", "test"], { cwd: root });

			await writeFile(join(root, "file.txt"), "hello\n");
			await execa("git", ["add", "."], { cwd: root });

			const result = await sdk.commit.run({
				message: "feat: test",
				noTest: true,
				cwd: root,
			});
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			const head = await execa("git", ["rev-parse", "HEAD"], { cwd: root });
			expect(head.exitCode).toBe(0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
