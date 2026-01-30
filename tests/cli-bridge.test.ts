import { execa } from "execa";
import { describe, expect, test } from "vitest";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], { reject: false });

describe("nooa bridge", () => {
	test("nooa bridge --help shows bridge usage", async () => {
		const res = await run(["bridge", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa bridge");
		expect(res.stdout).toContain("--op");
		expect(res.stdout).toContain("--param");
	});
});
