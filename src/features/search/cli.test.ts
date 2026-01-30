import { describe, expect, it } from "bun:test";
import { execa } from "execa";
const binPath = "./index.ts";

describe("nooa search", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "search", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa search");
		expect(res.stdout).toContain("<query>");
		expect(res.stdout).toContain("--json");
	});
});
