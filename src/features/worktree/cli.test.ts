import { describe, expect, it } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

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
});
