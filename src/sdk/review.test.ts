import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.review", () => {
	it("reviews a file and returns JSON result", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-review-"));
		const prevProvider = process.env.NOOA_AI_PROVIDER;
		process.env.NOOA_AI_PROVIDER = "mock";
		try {
			const filePath = join(root, "review.ts");
			await writeFile(filePath, "export const value = 1;\n");

			const { sdk } = await import("./index");
			const result = await sdk.review.run({ path: filePath, json: true });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.result?.findings.length).toBeGreaterThan(0);
			}
		} finally {
			process.env.NOOA_AI_PROVIDER = prevProvider;
			await rm(root, { recursive: true, force: true });
		}
	});
});
