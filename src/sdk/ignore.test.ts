import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.ignore", () => {
	it("adds and checks patterns", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-ignore-"));
		try {
			await writeFile(join(root, "file.ts"), "const x = 1;\n");
			const addResult = await sdk.ignore.add({ pattern: "**/*.ts", cwd: root });
			expect(addResult.ok).toBe(true);
			const checkResult = await sdk.ignore.check({ path: "file.ts", cwd: root });
			expect(checkResult.ok).toBe(true);
			if (!checkResult.ok) {
				throw new Error("Expected ok result");
			}
			expect(checkResult.data.ignored).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
