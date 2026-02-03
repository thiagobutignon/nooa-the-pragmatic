import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.search", () => {
	it("finds matches in a temp directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-search-"));
		try {
			const filePath = join(root, "note.txt");
			await writeFile(filePath, "needle here\n");

			const { sdk } = await import("./index");
			const result = await sdk.search.run({ query: "needle", root });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.results.length).toBeGreaterThan(0);
				expect(result.data.results[0]?.snippet).toContain("needle");
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
