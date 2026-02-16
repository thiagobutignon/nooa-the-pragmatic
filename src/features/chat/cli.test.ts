import { describe, expect, mock, test } from "bun:test";
import { run } from "./cli";

// Mock execute module
const mockExecuteMessage = mock();
const mockFormatOutput = mock();

mock.module("./execute", () => ({
	executeMessage: mockExecuteMessage,
	formatOutput: mockFormatOutput,
}));

describe("Chat CLI", () => {
	test("run returns error if text is missing", async () => {
		const result = await run({ role: "user" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("message.missing_text");
		}
	});

	test("run returns error if role is invalid", async () => {
		const result = await run({ content: "Hi", role: "invalid" as any });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("message.invalid_role");
		}
	});

	test("run executes message and formats output", async () => {
		const mockMsg = { content: "Response", role: "assistant" };
		mockExecuteMessage.mockResolvedValue(mockMsg);
		mockFormatOutput.mockReturnValue("Formatted Output");

		const result = await run({ content: "Hi", role: "user" });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.output).toBe("Formatted Output");
			expect(result.data.message).toEqual(mockMsg);
		}
		expect(mockExecuteMessage).toHaveBeenCalledWith(
			"Hi",
			{ role: "user", json: false },
			undefined,
		);
		expect(mockFormatOutput).toHaveBeenCalledWith(mockMsg, false);
	});

	test("run handles json flag", async () => {
		const mockMsg = { content: "Response", role: "assistant" };
		mockExecuteMessage.mockResolvedValue(mockMsg);
		mockFormatOutput.mockReturnValue('{"json":true}');

		const result = await run({ content: "Hi", json: true });

		expect(result.ok).toBe(true);
		expect(mockExecuteMessage).toHaveBeenCalledWith(
			"Hi",
			{ role: "user", json: true },
			undefined,
		);
		expect(mockFormatOutput).toHaveBeenCalledWith(mockMsg, true);
	});

	test("run handles runtime error", async () => {
		mockExecuteMessage.mockRejectedValue(new Error("Network fail"));

		const result = await run({ content: "Hi" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("message.runtime_error");
		}
	});
});
