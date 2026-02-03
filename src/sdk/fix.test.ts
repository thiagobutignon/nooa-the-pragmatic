import { describe, expect, it } from "bun:test";


describe("sdk.fix", () => {
	it("runs fix in dry-run mode", async () => {
		const { sdk } = await import("./index");
		process.env.NOOA_AI_PROVIDER = "mock";
		try {
			const result = await sdk.fix.run({ issue: "test issue", dryRun: true });
			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Expected ok result");
			}
			expect(result.data.result.ok).toBe(true);
		} finally {
			delete process.env.NOOA_AI_PROVIDER;
		}
	});
});
