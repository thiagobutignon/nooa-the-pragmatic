import { describe, expect, test } from "bun:test";
import { measurePromptStats } from "../../src/scripts/measure-prompt-stats";

process.env.NOOA_EMBED_PROVIDER = "mock";

describe("measurePromptStats", () => {
	test("returns token stats for dynamic prompt", async () => {
		const result = await measurePromptStats({
			root: process.cwd(),
			task: "criar teste",
		});

		expect(result.dynamicTokens).toBeGreaterThan(0);
		expect(result.staticTokens).toBeGreaterThan(0);
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
	});
});
