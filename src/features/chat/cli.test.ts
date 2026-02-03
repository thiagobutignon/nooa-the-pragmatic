import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = join(repoRoot, "index.ts");

describe("nooa message", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`nooa-chat-test-${Math.random().toString(36).slice(2, 7)}`,
		);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("shows help", async () => {
		const res = await execa(bunPath, [binPath, "message", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: testDir,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa message <text> [flags]");
	});

	describe("validation", () => {
		it("requires message text", async () => {
			const res = await execa(bunPath, [binPath, "message"], {
				reject: false,
				env: baseEnv,
				cwd: testDir,
			});
			expect(res.exitCode).toBe(2);
			expect(res.stderr).toContain("Error: Message text is required");
		});

		it("validates role values", async () => {
			const res = await execa(
				bunPath,
				[binPath, "message", "test", "--role", "invalid"],
				{ reject: false, env: baseEnv, cwd: testDir },
			);
			expect(res.exitCode).toBe(2);
			expect(res.stderr).toContain("Invalid role");
		});

		it("accepts valid roles", async () => {
			const roles = ["user", "system", "assistant"];
			for (const role of roles) {
				const res = await execa(
					bunPath,
					[binPath, "message", "test", "--role", role],
					{ reject: false, env: baseEnv, cwd: testDir },
				);
				expect(res.exitCode).toBe(0);
			}
		});
	});

	describe("integration", () => {
		it("outputs plain text by default", async () => {
			const res = await execa(bunPath, [binPath, "message", "Hello world"], {
				reject: false,
				env: baseEnv,
				cwd: testDir,
			});
			expect(res.exitCode).toBe(0);
			expect(res.stdout).toContain("[user] Hello world");
		});

		it("outputs JSON when --json flag is used", async () => {
			const res = await execa(bunPath, [binPath, "message", "Test", "--json"], {
				reject: false,
				env: baseEnv,
				cwd: testDir,
			});
			expect(res.exitCode).toBe(0);
			const output = JSON.parse(res.stdout);
			expect(output).toHaveProperty("role", "user");
			expect(output).toHaveProperty("content", "Test");
		});

		it("respects role flag", async () => {
			const res = await execa(
				bunPath,
				[binPath, "message", "Init", "--role", "system"],
				{ reject: false, env: baseEnv, cwd: testDir },
			);
			expect(res.exitCode).toBe(0);
			expect(res.stdout).toContain("[system] Init");
		});
	});
});
