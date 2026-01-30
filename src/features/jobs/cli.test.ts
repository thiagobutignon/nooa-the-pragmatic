import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], { reject: false });

describe("nooa jobs", () => {
	test("nooa jobs --help shows jobs usage", async () => {
		const res = await run(["jobs", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa jobs");
		expect(res.stdout).toContain("--search");
		expect(res.stdout).toContain("--provider");
	});
});
