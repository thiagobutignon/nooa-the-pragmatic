import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContextEngine } from "./engine";

describe("ContextEngine", () => {
	test("getEnvState returns os and cwd", async () => {
		const engine = new ContextEngine();
		const root = "/tmp/nooa-context";
		const env = await engine.getEnvState(root);

		expect(env).toEqual({ cwd: root, os: process.platform });
	});

	test("getGitState returns null outside a git repository", async () => {
		const engine = new ContextEngine();
		const root = await mkdtemp(join(tmpdir(), "nooa-context-"));
		try {
			const git = await engine.getGitState(root);
			expect(git).toBeNull();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
