import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

const TEST_DIR = join(import.meta.dir, "tmp-test-check");

describe("sdk.check", () => {
	it("runs policy checks on explicit files", async () => {
		await mkdir(TEST_DIR, { recursive: true });
		const testFile = join(TEST_DIR, "bad.ts");
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
	});
});
