import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

async function createTempRepo(gitignore = "") {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-cli-"));
	await execa("git", ["init"], { cwd: root });
	await execa("git", ["branch", "-m", "main"], { cwd: root });
	await writeFile(join(root, ".gitignore"), gitignore);
	await writeFile(join(root, "README.md"), "ralph cli test\n");
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
	return root;
}

describe("nooa ralph", () => {
	it("shows help", async () => {
		const res = await execa(bunPath, [binPath, "ralph", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});

		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa ralph");
		expect(res.stdout).toContain("init");
		expect(res.stdout).toContain("status");
		expect(res.stdout).toContain("select-story");
		expect(res.stdout).toContain("step");
		expect(res.stdout).toContain("run");
	});

	it("initializes ralph state from the CLI", async () => {
		const root = await createTempRepo(".nooa/ralph/\n");
		try {
			const res = await execa(bunPath, [binPath, "ralph", "init"], {
				reject: false,
				env: {
					...baseEnv,
					NOOA_AI_PROVIDER: "openai",
					NOOA_AI_MODEL: "gpt-5-codex",
					NOOA_REVIEW_AI_PROVIDER: "anthropic",
					NOOA_REVIEW_AI_MODEL: "claude-3.7",
				},
				cwd: root,
			});

			expect(res.exitCode).toBe(0);
			expect(existsSync(join(root, ".nooa", "ralph", "state.json"))).toBe(true);
			expect(existsSync(join(root, ".nooa", "ralph", "prd.json"))).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("returns JSON status when no run exists", async () => {
		const root = await createTempRepo(".nooa/ralph/\n");
		try {
			const res = await execa(bunPath, [binPath, "ralph", "status", "--json"], {
				reject: false,
				env: baseEnv,
				cwd: root,
			});

			expect(res.exitCode).toBe(0);
			const parsed = JSON.parse(res.stdout);
			expect(parsed.command).toBe("ralph");
			expect(parsed.action).toBe("status");
			expect(parsed.initialized).toBe(false);
			expect(parsed.runId).toBeNull();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
