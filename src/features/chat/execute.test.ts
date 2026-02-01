import { describe, expect, it } from "bun:test";
import { executeMessage } from "./execute";
import type { MessageRole } from "./types";

describe("executeMessage", () => {
	it("returns message object with timestamp", async () => {
		const result = await executeMessage("Hello", { role: "user", json: false });

		expect(result).toHaveProperty("role", "user");
		expect(result).toHaveProperty("content", "Hello");
		expect(result).toHaveProperty("timestamp");
		expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
	});

	it("handles different roles", async () => {
		const roles: MessageRole[] = ["user", "system", "assistant"];

		for (const role of roles) {
			const result = await executeMessage("Test", { role, json: false });
			expect(result.role).toBe(role);
		}
	});
});
