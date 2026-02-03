import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("sdk.ai", () => {
	it("runs via mock provider", async () => {
		const result = await sdk.ai.run({ prompt: "hello", provider: "mock" });
		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected ok result");
		}
		expect(result.data.type).toBe("completion");
		if (result.data.type === "completion") {
			expect(result.data.response.provider).toBe("mock");
			expect(result.data.response.content).toContain("hello");
		}
	});
});
