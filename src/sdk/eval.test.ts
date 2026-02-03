import { describe, expect, it } from "bun:test";


describe("sdk.eval", () => {
	it("loads suite and records history", async () => {
		const { sdk } = await import("./index");
		process.env.NOOA_AI_PROVIDER = "mock";
		process.env.NOOA_EVAL_HISTORY_DATA = "[]";
		try {
			const runResult = await sdk.eval.run({
				prompt: "review",
				suite: "review.instant-file",
				judge: "deterministic",
			});
			expect(runResult.ok).toBe(true);
			if (!runResult.ok) {
				throw new Error("Expected ok run result");
			}

			const historyResult = await sdk.eval.history({
				prompt: "review",
				suite: "review.instant-file",
			});
			expect(historyResult.ok).toBe(true);
			if (!historyResult.ok) {
				throw new Error("Expected ok history result");
			}
			expect(Array.isArray(historyResult.data)).toBe(true);
		} finally {
			delete process.env.NOOA_AI_PROVIDER;
			delete process.env.NOOA_EVAL_HISTORY_DATA;
		}
	});
});
