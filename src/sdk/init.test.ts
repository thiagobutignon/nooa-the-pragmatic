import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.init", () => {
	it("initializes .nooa files", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-init-"));
		try {
			const { sdk } = await import("./index");
			const result = await sdk.init.run({ root, name: "NOOA", dryRun: false });
			expect(result.ok).toBe(true);
			const constitution = await readFile(join(root, ".nooa", "CONSTITUTION.md"), "utf8");
			expect(constitution.length).toBeGreaterThan(0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
