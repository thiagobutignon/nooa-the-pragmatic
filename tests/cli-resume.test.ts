import { execa } from "execa";
import { describe, expect, test } from "vitest";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], { reject: false });

describe("nooa resume", () => {
	test("nooa resume --help shows resume usage", async () => {
		const res = await run(["resume", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa resume");
		expect(res.stdout).toContain("--to-pdf");
		expect(res.stdout).toContain("--to-json-resume");
	});
});
