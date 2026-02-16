import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

describe("nooa code delete/remove", () => {
	let testDir: string;
	let OUT: string;

	const run = (args: string[]) =>
		execa(bunPath, [join(repoRoot, "index.ts"), ...args], {
			reject: false,
			env: baseEnv,
			cwd: testDir,
		});

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`nooa-code-delete-test-${Math.random().toString(36).slice(2, 7)}`,
		);
		await mkdir(testDir, { recursive: true });
		OUT = join(testDir, "tmp-cli-delete.txt");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("nooa code --help shows delete and remove subcommands", async () => {
		const res = await run(["code", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("delete <path>");
		expect(res.stdout).toContain("remove <path>");
	});

	test("deletes file with delete subcommand", async () => {
		await writeFile(OUT, "to delete");
		const res = await run(["code", "delete", OUT]);
		expect(res.exitCode).toBe(0);
		expect(existsSync(OUT)).toBe(false);
	});

	test("deletes file with remove alias", async () => {
		await writeFile(OUT, "to remove");
		const res = await run(["code", "remove", OUT]);
		expect(res.exitCode).toBe(0);
		expect(existsSync(OUT)).toBe(false);
	});

	test("delete with --dry-run keeps file and returns JSON", async () => {
		await writeFile(OUT, "dry-run delete");
		const res = await run(["code", "delete", OUT, "--dry-run", "--json"]);
		expect(res.exitCode).toBe(0);
		const payload = JSON.parse(res.stdout);
		expect(payload.mode).toBe("delete");
		expect(payload.dryRun).toBe(true);
		expect(payload.deleted).toBe(false);
		expect(existsSync(OUT)).toBe(true);
	});
});
