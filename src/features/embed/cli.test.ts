import { describe, it, expect } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa embed", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "embed", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa embed <text|file>");
		expect(res.stdout).toContain("--include-embedding");
		expect(res.stdout).toContain("--out <file>");
	});
});
