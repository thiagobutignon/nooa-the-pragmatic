import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[], input?: string) =>
	execa("bun", ["index.ts", ...args], { reject: false, input });

describe("nooa code write --patch", () => {
	test("--help includes patch flags", async () => {
		const res = await run(["code", "write", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("--patch");
		expect(res.stdout).toContain("--patch-from");
		expect(res.stdout).toContain("Mutually exclusive");
	});
});
