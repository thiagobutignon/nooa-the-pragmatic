import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { executeFix } from "./execute";

describe("executeFix", () => {
	let originalProvider: string | undefined;

	beforeEach(() => {
		originalProvider = process.env.NOOA_AI_PROVIDER;
		process.env.NOOA_AI_PROVIDER = "mock";
	});

	afterEach(() => {
		if (originalProvider) {
			process.env.NOOA_AI_PROVIDER = originalProvider;
		} else {
			delete process.env.NOOA_AI_PROVIDER;
		}
	});

	it("should track telemetry and return ok", async () => {
		const { result, traceId } = await executeFix({
			json: true,
		});

		expect(traceId).toBeDefined();
		expect(result.message).toBe("Action performed by fix");
	});
});
