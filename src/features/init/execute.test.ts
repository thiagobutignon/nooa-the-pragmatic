import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeInit } from "./execute";

describe("executeInit", () => {
	let root = "";

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "nooa-init-"));
	});

	afterEach(async () => {
		if (!root) return;
		await rm(root, { recursive: true, force: true });
	});

	test("creates durable memory file in .nooa", async () => {
		await executeInit({ root });

		const memoryPath = join(root, ".nooa", "MEMORY.md");
		expect(await Bun.file(memoryPath).exists()).toBe(true);
	});
});
