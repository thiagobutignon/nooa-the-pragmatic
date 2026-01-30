import { afterEach, describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { writeCodeFile } from "../src/code/write";

const OUT = "tmp-code-write.txt";

afterEach(async () => {
	await rm(OUT, { force: true });
});

describe("writeCodeFile", () => {
	test("writes content when file does not exist", async () => {
		const result = await writeCodeFile({
			path: OUT,
			content: "hello",
			overwrite: false,
			dryRun: false,
		});

		expect(result.path).toBe(OUT);
		expect(result.bytes).toBe(5);
		expect(result.overwritten).toBe(false);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("hello");
	});

	test("fails when file exists without overwrite", async () => {
		await writeFile(OUT, "existing");
		await expect(
			writeCodeFile({
				path: OUT,
				content: "new",
				overwrite: false,
				dryRun: false,
			}),
		).rejects.toThrow("already exists");
	});

	test("overwrites when overwrite is true", async () => {
		await writeFile(OUT, "existing");
		const result = await writeCodeFile({
			path: OUT,
			content: "new",
			overwrite: true,
			dryRun: false,
		});

		expect(result.overwritten).toBe(true);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("new");
	});

	test("dry-run does not write file", async () => {
		const result = await writeCodeFile({
			path: OUT,
			content: "hello",
			overwrite: false,
			dryRun: true,
		});

		expect(result.bytes).toBe(5);
		await expect(readFile(OUT, "utf-8")).rejects.toThrow();
	});
});
