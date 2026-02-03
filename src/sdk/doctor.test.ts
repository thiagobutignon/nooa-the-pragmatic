import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.doctor", () => {
	it("runs tool checks", async () => {
		const result = await sdk.doctor.run();
		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected ok result");
		}
		expect(typeof result.data.ok).toBe("boolean");
		expect(result.data.bun).toBeDefined();
	});
});
