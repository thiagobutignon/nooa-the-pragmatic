import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

describe("nooa code write", () => {
	let testDir: string;
	let OUT: string;
	let SRC: string;

	const run = (args: string[]) =>
		execa(bunPath, [join(repoRoot, "index.ts"), ...args], {
			reject: false,
			env: baseEnv,
			cwd: testDir,
		});

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`nooa-code-write-test-${Math.random().toString(36).slice(2, 7)}`,
		);
		await mkdir(testDir, { recursive: true });
		OUT = join(testDir, "tmp-cli-write.txt");
		SRC = join(testDir, "tmp-cli-src.txt");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("nooa code write --help shows usage", async () => {
		const res = await run(["code", "write", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain(
			"Usage: nooa code <subcommand> [args] [flags]",
		);
		expect(res.stdout).toContain("--from <path>");
		expect(res.stdout).toContain("--overwrite");
		expect(res.stdout).toContain("--json");
		expect(res.stdout).toContain("--dry-run");
	});

	test("writes from --from file", async () => {
		await writeFile(SRC, "from-file");
		const res = await run(["code", "write", OUT, "--from", SRC]);
		expect(res.exitCode).toBe(0);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("from-file");
	});

	test("fails if file exists without --overwrite", async () => {
		await writeFile(SRC, "new content");
		await writeFile(OUT, "existing");
		const res = await run(["code", "write", OUT, "--from", SRC]);
		expect(res.exitCode).toBe(1);
	});

	test("supports --overwrite", async () => {
		await writeFile(SRC, "new");
		await writeFile(OUT, "existing");
		const res = await run(["code", "write", OUT, "--from", SRC, "--overwrite"]);
		expect(res.exitCode).toBe(0);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("new");
	});

	test("writes from stdin", async () => {
		const res = await execa(
			bunPath,
			[join(repoRoot, "index.ts"), "code", "write", OUT],
			{
				input: "from-stdin",
				reject: false,
				env: baseEnv,
				cwd: testDir,
			},
		);
		expect(res.exitCode).toBe(0);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("from-stdin");
	});

	test("dry-run reports without writing", async () => {
		await writeFile(SRC, "dry-run");
		const res = await run([
			"code",
			"write",
			OUT,
			"--from",
			SRC,
			"--dry-run",
			"--json",
		]);
		expect(res.exitCode).toBe(0);
		const payload = JSON.parse(res.stdout);
		expect(payload.dryRun).toBe(true);
		expect(existsSync(OUT)).toBe(false);
	});
});
