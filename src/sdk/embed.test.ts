import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.embed", () => {
	it("embeds text via mock provider", async () => {
		const originalProvider = process.env.NOOA_EMBED_PROVIDER;
		process.env.NOOA_EMBED_PROVIDER = "mock";
		try {
			const result = await sdk.embed.text({ text: "hello" });
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			expect(result.data.provider).toBe("mock");
			expect(result.data.dimensions).toBe(8);
		} finally {
			if (originalProvider === undefined) {
				delete process.env.NOOA_EMBED_PROVIDER;
			} else {
				process.env.NOOA_EMBED_PROVIDER = originalProvider;
			}
		}
	});
});
