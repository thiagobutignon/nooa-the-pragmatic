import { describe, expect, it } from "bun:test";
import type { AiEngine } from "../../features/ai/engine";
import { AiEngineAgentProvider } from "./provider";

describe("AiEngineAgentProvider", () => {
	it("maps engine completion into agent response without tool calls", async () => {
		const engine = {
			complete: async () => ({
				content: "hello from model",
				model: "mock-model",
				provider: "mock",
			}),
		} as Pick<AiEngine, "complete">;

		const provider = new AiEngineAgentProvider(engine);
		const response = await provider.generate({
			messages: [{ role: "user", content: "hi" }],
		});

		expect(response.content).toBe("hello from model");
		expect(response.toolCalls).toHaveLength(0);
	});

	it("converts tool role messages into assistant-compatible content", async () => {
		let capturedRoles: string[] = [];

		const engine = {
			complete: async (request: {
				messages: { role: string; content: string }[];
			}) => {
				capturedRoles = request.messages.map((m) => m.role);
				return {
					content: "ok",
					model: "mock-model",
					provider: "mock",
				};
			},
		} as Pick<AiEngine, "complete">;

		const provider = new AiEngineAgentProvider(engine);
		await provider.generate({
			messages: [
				{ role: "system", content: "sys" },
				{ role: "tool", content: "tool output" },
				{ role: "user", content: "continue" },
			],
		});

		expect(capturedRoles).toEqual(["system", "assistant", "user"]);
	});
});
