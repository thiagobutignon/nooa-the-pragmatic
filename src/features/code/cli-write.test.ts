import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { execa } from "execa";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], { reject: false });

const OUT = "tmp-cli-write.txt";
const SRC = "tmp-cli-src.txt";

afterEach(async () => {
	await rm(OUT, { force: true });
	await rm(SRC, { force: true });
});

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

	test("writes from --from file", async () => {
		await writeFile(SRC, "from-file");
		const res = await run(["code", "write", OUT, "--from", SRC]);
		expect(res.exitCode).toBe(0);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("from-file");
	});

	test("fails if file exists without --overwrite", async () => {
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
		const res = await execa("bun", ["index.ts", "code", "write", OUT], {
			input: "from-stdin",
			reject: false,
		});
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
