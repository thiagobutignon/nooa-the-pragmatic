import { describe, expect, it } from "bun:test";
import { executeCi } from "./execute";

describe("executeCi", () => {
	it("should return structured result with ok and traceId", async () => {
		// Set env to skip long-running tests
		process.env.NOOA_SKIP_TEST = "1";

		const result = await executeCi({ json: true });

		expect(result.traceId).toBeDefined();
		expect(result).toHaveProperty("ok");
		expect(result).toHaveProperty("test");
		expect(result).toHaveProperty("lint");
		expect(result).toHaveProperty("check");

		delete process.env.NOOA_SKIP_TEST;
	}, 30000); // 30s timeout for CI pipeline
});
