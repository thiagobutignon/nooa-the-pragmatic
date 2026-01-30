import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], { reject: false });

describe("nooa code write", () => {
	test("nooa code write --help shows usage", async () => {
		const res = await run(["code", "write", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa code write <path>");
		expect(res.stdout).toContain("--from <path>");
		expect(res.stdout).toContain("--overwrite");
		expect(res.stdout).toContain("--json");
		expect(res.stdout).toContain("--dry-run");
	});
});
