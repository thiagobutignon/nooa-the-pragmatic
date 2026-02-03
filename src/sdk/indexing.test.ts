import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.index", () => {
	it("indexes files and searches", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-index-"));
		const dbPath = join(root, "nooa.db");
		const originalDb = process.env.NOOA_DB_PATH;
		const originalProvider = process.env.NOOA_AI_PROVIDER;
		process.env.NOOA_DB_PATH = dbPath;
		process.env.NOOA_AI_PROVIDER = "mock";
		try {
			const filePath = join(root, "file.ts");
			await writeFile(filePath, "export const hello = 'world';\n", "utf8");

			const { sdk } = await import("./index");
			const buildResult = await sdk.index.build({ root });
			expect(buildResult.ok).toBe(true);
			if (!buildResult.ok) {
				throw new Error("Expected ok build result");
			}

			const statsResult = await sdk.index.stats();
			expect(statsResult.ok).toBe(true);
			if (!statsResult.ok) {
				throw new Error("Expected ok stats result");
			}
			expect(statsResult.data.documents).toBeGreaterThan(0);

			const searchResult = await sdk.index.search({ query: "hello", limit: 2 });
			expect(searchResult.ok).toBe(true);
			if (!searchResult.ok) {
				throw new Error("Expected ok search result");
			}
			expect(Array.isArray(searchResult.data)).toBe(true);
		} finally {
			if (originalDb === undefined) {
				delete process.env.NOOA_DB_PATH;
			} else {
				process.env.NOOA_DB_PATH = originalDb;
			}
			if (originalProvider === undefined) {
				delete process.env.NOOA_AI_PROVIDER;
			} else {
				process.env.NOOA_AI_PROVIDER = originalProvider;
			}
			await rm(root, { recursive: true, force: true });
		}
	});
});
