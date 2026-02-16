import { describe, expect, it } from "bun:test";
import type { AgentModelProvider } from "../../runtime/agent/loop";
import { run } from "./engine";

describe("agent engine", () => {
	it("returns validation error when prompt is missing", async () => {
		const result = await run({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("agent.missing_prompt");
		}
	});

	it("returns runtime error instead of throwing when provider fails", async () => {
		const failingProvider: AgentModelProvider = {
			generate: async () => {
				throw new Error("boom");
			},
		};

		const result = await run({
			prompt: "hello",
			provider: failingProvider,
			workspace: process.cwd(),
			sessionKey: "test:provider-error",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("agent.runtime_error");
			expect(result.error.message).toContain("boom");
		}
	});
});
