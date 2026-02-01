import { describe, expect, it } from "bun:test";
import { executeDoctorCheck } from "./execute";

describe("executeDoctorCheck", () => {
	it(
		"should check all required tools and return result",
		async () => {
			const result = await executeDoctorCheck();

			expect(result.traceId).toBeDefined();
			expect(result).toHaveProperty("ok");
			expect(result).toHaveProperty("bun");
			expect(result).toHaveProperty("git");
			expect(result).toHaveProperty("rg");
			expect(result).toHaveProperty("sqlite");
			expect(result).toHaveProperty("duration_ms");

			// These tools should be available in dev environment
			expect(result.bun.available).toBe(true);
			expect(result.git.available).toBe(true);
		},
		30000,
	); // 30s timeout
});
