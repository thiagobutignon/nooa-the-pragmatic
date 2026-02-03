import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("sdk.ci", () => {
	it("runs CI pipeline with recursion guard", async () => {
		const original = process.env.NOOA_SKIP_CI_RECURSION;
		process.env.NOOA_SKIP_CI_RECURSION = "1";
		try {
			const result = await sdk.ci.run({});
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			expect(result.data.ok).toBe(true);
		} finally {
			if (original === undefined) {
				delete process.env.NOOA_SKIP_CI_RECURSION;
			} else {
				process.env.NOOA_SKIP_CI_RECURSION = original;
			}
		}
	});
});
