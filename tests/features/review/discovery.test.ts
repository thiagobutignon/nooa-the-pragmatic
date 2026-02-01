import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverTests } from "../../../src/features/review/discovery";

describe("Test Discovery heuristic", () => {
	let root = "";

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "nooa-discovery-"));
		await mkdir(join(root, "src"), { recursive: true });
		await writeFile(join(root, "src/foo.ts"), "// source");
		await writeFile(join(root, "src/foo.test.ts"), "// test");
		await mkdir(join(root, "tests"), { recursive: true });
		await writeFile(join(root, "tests/bar.test.ts"), "// other test");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("finds test in same directory", async () => {
		const candidates = await discoverTests(join(root, "src/foo.ts"), root);
		expect(candidates).toContain("src/foo.test.ts");
	});

	it("finds test in root tests/ directory", async () => {
		// Create bar.ts and tests/bar.test.ts
		await writeFile(join(root, "src/bar.ts"), "// source");
		await writeFile(join(root, "tests/bar.test.ts"), "// test");

		const candidates = await discoverTests(join(root, "src/bar.ts"), root);
		expect(candidates).toContain("tests/bar.test.ts");
	});

	it("returns empty array if no test found", async () => {
		await writeFile(join(root, "src/baz.ts"), "// source");
		const candidates = await discoverTests(join(root, "src/baz.ts"), root);
		expect(candidates).toEqual([]);
	});
});
