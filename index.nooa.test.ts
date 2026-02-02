import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "./src/test-utils/cli-env";

const run = (args: string[]) =>
	execa(bunPath, ["index.ts", ...args], {
		reject: false,
		env: baseEnv,
		cwd: repoRoot,
	});

describe("nooa root", () => {
	test("nooa --help shows root usage and subcommands", async () => {
		const res = await run(["--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa");
		expect(res.stdout).toContain("search");
		expect(res.stdout).toContain("Search files and file contents");
	});

	test("nooa --version prints 0.0.1", async () => {
		const res = await run(["--version"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa");
	});

	test("package.json exposes nooa bin", async () => {
		const pkg = JSON.parse(await readFile("package.json", "utf-8"));
		expect(pkg.bin.nooa).toBe("index.ts");
	});
});
