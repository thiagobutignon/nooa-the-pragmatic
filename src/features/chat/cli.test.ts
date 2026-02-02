import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = "./index.ts";

describe("nooa message", () => {
	it("shows help", async () => {
		const res = await execa(bunPath, [binPath, "message", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa message <text> [flags]");
		expect(res.stdout).toContain("Flags:");
		expect(res.stdout).toContain("--role");
		expect(res.stdout).toContain("--json");
		expect(res.stdout).toContain("-h, --help");
	});
});

describe("nooa message validation", () => {
	it("requires message text", async () => {
		const res = await execa(bunPath, [binPath, "message"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(res.exitCode).toBe(2);
		expect(res.stderr).toContain("Error: Message text is required");
	});

	it("validates role values", async () => {
		const res = await execa(
			bunPath,
			[binPath, "message", "test", "--role", "invalid"],
			{ reject: false, env: baseEnv, cwd: repoRoot },
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
				{ reject: false, env: baseEnv, cwd: repoRoot },
			);
			expect(res.exitCode).toBe(0);
		}
	});
});

describe("nooa message integration", () => {
	it("outputs plain text by default", async () => {
		const res = await execa(bunPath, [binPath, "message", "Hello world"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("[user] Hello world");
	});

	it("outputs JSON when --json flag is used", async () => {
		const res = await execa(bunPath, [binPath, "message", "Test", "--json"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(res.exitCode).toBe(0);

		const output = JSON.parse(res.stdout);
		expect(output).toHaveProperty("role", "user");
		expect(output).toHaveProperty("content", "Test");
		expect(output).toHaveProperty("timestamp");
	});

	it("respects role flag", async () => {
		const res = await execa(
			bunPath,
			[binPath, "message", "Init", "--role", "system"],
			{ reject: false, env: baseEnv, cwd: repoRoot },
		);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("[system] Init");
	});
});
