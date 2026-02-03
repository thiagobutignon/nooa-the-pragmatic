import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("sdk.check", () => {
	it("runs policy checks on explicit files", async () => {
		const testDir = await mkdtemp(join(tmpdir(), "nooa-check-"));
		const testFile = join(testDir, "bad.ts");
		try {
			await writeFile(testFile, "// TODO: fix\n", "utf8");

			const result = await sdk.check.run({ paths: [testFile] });
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			expect(result.data.type).toBe("policy");
			if (result.data.type === "policy") {
				expect(result.data.result.ok).toBe(false);
				expect(result.data.result.violations.length).toBeGreaterThan(0);
			}
		} finally {
			await rm(testDir, { recursive: true, force: true });
		}
	});
});
