import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("sdk.ask", () => {
	it("returns search results", async () => {
		const originalProvider = process.env.NOOA_AI_PROVIDER;
		process.env.NOOA_AI_PROVIDER = "mock";
		try {
			const result = await sdk.ask.run({ query: "hello", limit: 2 });
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			expect(Array.isArray(result.data)).toBe(true);
		} finally {
			if (originalProvider === undefined) {
				delete process.env.NOOA_AI_PROVIDER;
			} else {
				process.env.NOOA_AI_PROVIDER = originalProvider;
			}
		}
	});
});
