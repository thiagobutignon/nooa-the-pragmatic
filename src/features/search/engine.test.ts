import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSearch } from "./engine";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "nooa-search-engine-"));
	await writeFile(join(root, "a.txt"), "TODO: alpha\nimport x\n");
	await writeFile(join(root, "b.test.ts"), "TODO: test file\n");
	await writeFile(join(root, "c.ts"), "import { foo } from 'bar'\n");
});

afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("runSearch engine", () => {
	it("detects rg availability", async () => {
		const { hasRipgrep } = await import("./engine");
		expect(typeof hasRipgrep).toBe("function");
	});

	it("handles empty results", async () => {
		const results = await runSearch({
			query: "NONEXISTENT_PATTERN_XYZ123",
			root,
			maxResults: 5,
		});
		expect(results).toEqual([]);
	});

	it("returns matches with metadata", async () => {
		const results = await runSearch({ query: "TODO", root, maxResults: 5 });
		expect(Array.isArray(results)).toBe(true);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.path).toContain(root);
	});

	it("respects maxResults limit", async () => {
		const results = await runSearch({ query: "import", root, maxResults: 1 });
		expect(results.length).toBeLessThanOrEqual(1);
	});

	it("handles regex patterns", async () => {
		const results = await runSearch({
			query: "\\bTODO\\b",
			root,
			regex: true,
			maxResults: 5,
		});
		expect(Array.isArray(results)).toBe(true);
	});

	it("applies include/exclude patterns", async () => {
		const results = await runSearch({
			query: "import",
			root,
			include: ["*.ts"],
			exclude: ["*.test.ts"],
			maxResults: 10,
		});
		results.forEach((r) => {
			expect(r.path).toMatch(/\.ts$/);
			expect(r.path).not.toMatch(/\.test\.ts$/);
		});
	});
});
