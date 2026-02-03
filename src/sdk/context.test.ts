import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.context", () => {
	it("builds context for a file", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-context-"));
		const filePath = join(root, "file.ts");
		try {
			await writeFile(filePath, "export const value = 1;\n", "utf8");
			const result = await sdk.context.build({ target: filePath });
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			expect(result.data.target).toContain("file.ts");
			expect(result.data.content).toContain("value");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
