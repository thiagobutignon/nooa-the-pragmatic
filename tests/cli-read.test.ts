import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[], input?: string) =>
	execa("bun", ["index.ts", ...args], { reject: false, input });

describe("nooa read", () => {
	test("nooa read --help shows usage", async () => {
		const res = await run(["read", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa read <path>");
		expect(res.stdout).toContain("--json");
	});
});
