import { beforeEach, describe, expect, it } from "bun:test";
import { AiEngine } from "./engine";
import type { AiProvider, AiRequest, AiResponse } from "./types";

class MockProvider implements AiProvider {
	constructor(
		public name: string,
		private responses: string[] = ["mock response"],
	) {}
	async complete(_request: AiRequest): Promise<AiResponse> {
		const content = this.responses.shift() || "mock response";
		if (content === "FAIL") throw new Error("Transient failure");
		return {
			content,
			model: "mock-model",
			provider: this.name,
		};
	}
}

describe("AiEngine", () => {
	let engine: AiEngine;

	beforeEach(() => {
		engine = new AiEngine();
	});

	it("registers and uses a provider", async () => {
		const provider = new MockProvider("test-p");
		engine.register(provider);
		const res = await engine.complete(
			{ messages: [{ role: "user", content: "hi" }] },
			{ provider: "test-p" },
		);
		expect(res.provider).toBe("test-p");
		expect(res.content).toBe("mock response");
	});

	it("retries on failure", async () => {
		const provider = new MockProvider("flaky", ["FAIL", "FAIL", "success"]);
		engine.register(provider);
		// Should succeed on 3rd attempt
		const res = await engine.complete(
			{ messages: [{ role: "user", content: "hi" }] },
			{ provider: "flaky", maxRetries: 3, initialDelayMs: 0 },
		);
		expect(res.content).toBe("success");
	});

	it("falls back to secondary provider", async () => {
		const primary = new MockProvider("primary", ["FAIL"]);
		const secondary = new MockProvider("secondary", ["fallback success"]);
		engine.register(primary);
		engine.register(secondary);

		const res = await engine.complete(
			{ messages: [{ role: "user", content: "hi" }] },
			{ provider: "primary", fallbackProvider: "secondary", maxRetries: 0 },
		);
		expect(res.provider).toBe("secondary");
		expect(res.content).toBe("fallback success");
	});
});
