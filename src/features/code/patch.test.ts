import { describe, expect, test } from "bun:test";
import { applyPatch } from "./patch";

const original = "line1\nline2\nline3\n";
const patch = `--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2-updated\n line3\n`;

describe("applyPatch", () => {
	test("applies unified diff", () => {
		const result = applyPatch(original, patch);
		expect(result).toBe("line1\nline2-updated\nline3\n");
	});
});
