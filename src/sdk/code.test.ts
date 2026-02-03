import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.code", () => {
	it("writes a file", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-code-"));
		const target = join(root, "file.txt");
		try {
			const result = await sdk.code.write({
				path: target,
				content: "hello",
				overwrite: false,
				dryRun: false,
			});
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			const content = await readFile(target, "utf-8");
			expect(content).toBe("hello");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
