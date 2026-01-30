import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], { reject: false });

describe("nooa root", () => {
	test("nooa --help shows root usage and subcommands", async () => {
		const res = await run(["--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa");
		expect(res.stdout).toContain("resume");
		expect(res.stdout).toContain("jobs");
		expect(res.stdout).toContain("bridge");
	});

	test("nooa --version prints 0.0.1", async () => {
		const res = await run(["--version"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout.trim()).toBe("nooa v0.0.1");
	});

	test("package.json exposes nooa bin", async () => {
		const pkg = JSON.parse(await readFile("package.json", "utf-8"));
		expect(pkg.bin.nooa).toBe("index.ts");
	});
});
