import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readAgentDoc, run } from "./cli";
import { readMeta } from "./read-meta";

const TMP_DIR = join(import.meta.dir, "tmp-test-read");

describe("read feature", () => {
	beforeEach(async () => {
		await mkdir(TMP_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TMP_DIR, { recursive: true, force: true });
	});

	test("run accepts json flag for CLI parity", async () => {
		const testFile = join(TMP_DIR, "test.txt");
		await writeFile(testFile, "hello world");

		const result = await run({ path: testFile, json: true });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.content).toBe("hello world");
			expect(result.data.bytes).toBe(11);
		}
	});

	test("readMeta exposes name and version", () => {
		expect(readMeta.name).toBe("read");
		expect(readMeta.changelog[0]?.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("readAgentDoc embeds instruction and version", () => {
		expect(readAgentDoc).toContain("<instruction");
		expect(readAgentDoc).toContain(`version="${readMeta.changelog[0]?.version}"`);
	});
});
