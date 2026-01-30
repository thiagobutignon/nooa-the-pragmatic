import { afterEach, describe, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { execa } from "execa";

const run = (args: string[], input?: string) =>
	execa("bun", ["index.ts", ...args], { reject: false, input });

const OUT = "tmp-read.txt";

afterEach(async () => {
	await rm(OUT, { force: true });
});

describe("nooa read", () => {
	test("nooa read --help shows usage", async () => {
		const res = await run(["read", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa read <path>");
		expect(res.stdout).toContain("--json");
	});

	test("reads file content by path", async () => {
		await writeFile(OUT, "hello-read");
		const res = await run(["read", OUT]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toBe("hello-read");
	});

	test("returns error when file does not exist", async () => {
		const res = await run(["read", "missing.txt"]);
		expect(res.exitCode).toBe(1);
		expect(res.stderr).toContain("not found");
	});

	test("reads file path from stdin", async () => {
		await writeFile(OUT, "stdin-read");
		const res = await run(["read"], `${OUT}\n`);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toBe("stdin-read");
	});

	test("outputs json with metadata", async () => {
		await writeFile(OUT, "json-read");
		const res = await run(["read", OUT, "--json"]);
		expect(res.exitCode).toBe(0);
		const payload = JSON.parse(res.stdout);
		expect(payload.path).toBe(OUT);
		expect(payload.bytes).toBe(9);
		expect(payload.content).toBe("json-read");
	});
});
