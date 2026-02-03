import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.message", () => {
	it("sends message and formats output", async () => {
		const result = await sdk.message.send({ content: "hello", role: "user", json: true });
		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected ok result");
		}
		expect(result.data.message.content).toBe("hello");
		expect(result.data.output).toContain("\"content\"");
	});
});
