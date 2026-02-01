import { describe, expect, it } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa message", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "message", "--help"], {
			reject: false,
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
		const res = await execa("bun", [binPath, "message"], { reject: false });
		expect(res.exitCode).toBe(2);
		expect(res.stderr).toContain("Error: Message text is required");
	});

	it("validates role values", async () => {
		const res = await execa(
			"bun",
			[binPath, "message", "test", "--role", "invalid"],
			{ reject: false },
		);
		expect(res.exitCode).toBe(2);
		expect(res.stderr).toContain("Invalid role");
	});

	it("accepts valid roles", async () => {
		const roles = ["user", "system", "assistant"];
		for (const role of roles) {
			const res = await execa(
				"bun",
				[binPath, "message", "test", "--role", role],
				{ reject: false },
			);
			expect(res.exitCode).toBe(0);
		}
	});
});

describe("nooa message integration", () => {
	it("outputs plain text by default", async () => {
		const res = await execa("bun", [binPath, "message", "Hello world"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("[user] Hello world");
	});

	it("outputs JSON when --json flag is used", async () => {
		const res = await execa("bun", [binPath, "message", "Test", "--json"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);

		const output = JSON.parse(res.stdout);
		expect(output).toHaveProperty("role", "user");
		expect(output).toHaveProperty("content", "Test");
		expect(output).toHaveProperty("timestamp");
	});

	it("respects role flag", async () => {
		const res = await execa(
			"bun",
			[binPath, "message", "Init", "--role", "system"],
			{ reject: false },
		);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("[system] Init");
	});
});
