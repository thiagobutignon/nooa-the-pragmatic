import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.read", () => {
	it("reads file contents", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-read-"));
		try {
			const filePath = join(root, "hello.txt");
			await writeFile(filePath, "hello world\n");

			const { sdk } = await import("./index");
			const result = await sdk.read.run({ path: filePath });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.content).toBe("hello world\n");
				expect(result.data.bytes).toBe(12);
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
