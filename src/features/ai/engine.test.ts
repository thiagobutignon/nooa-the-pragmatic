import { beforeEach, describe, expect, it } from "bun:test";
import { AiEngine } from "./engine";
import type {
	AiEmbeddingRequest,
	AiEmbeddingResponse,
	AiProvider,
	AiRequest,
	AiResponse,
} from "./types";

class MockProvider implements AiProvider {
	constructor(
		public name: string,
		private responses: string[] = ["mock response"],
		private embeddingResponses: number[][] = [[0.1, 0.2]],
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

	async embed(_request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
		const vector = this.embeddingResponses.shift() || [0.1, 0.2];
		if (Array.isArray(vector) && (vector as unknown)[0] === -1)
			throw new Error("Embed failure");
		return {
			vector,
			model: "mock-embed-model",
		};
	}
}

describe("AiEngine", () => {
	let engine: AiEngine;

	beforeEach(() => {
		engine = new AiEngine();
	});

	describe("complete()", () => {
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

		it("throws error for missing provider", async () => {
			await expect(
				engine.complete({ messages: [] }, { provider: "non-existent" }),
			).rejects.toThrow("AI Provider not found: non-existent");
		});

		it("retries on failure", async () => {
			const provider = new MockProvider("flaky", ["FAIL", "FAIL", "success"]);
			engine.register(provider);
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

		it("rethrows error if fallback fails", async () => {
			const primary = new MockProvider("primary", ["FAIL"]);
			const secondary = new MockProvider("secondary", ["FAIL"]);
			engine.register(primary);
			engine.register(secondary);

			await expect(
				engine.complete(
					{ messages: [] },
					{ provider: "primary", fallbackProvider: "secondary", maxRetries: 0 },
				),
			).rejects.toThrow("Transient failure");
		});
	});

	describe("embed()", () => {
		it("uses provider for embedding", async () => {
			const provider = new MockProvider("embedder", [], [[0.5, 0.6]]);
			engine.register(provider);
			const res = await engine.embed(
				{ input: "test" },
				{ provider: "embedder" },
			);
			expect(res.vector).toEqual([0.5, 0.6]);
		});

		it("throws error for missing provider in embed", async () => {
			await expect(
				engine.embed({ input: "test" }, { provider: "missing" }),
			).rejects.toThrow("AI Provider not found: missing");
		});

		it("retries on embed failure", async () => {
			const provider = new MockProvider("flaky-e", [], [[-1], [0.9]]);
			engine.register(provider);
			const res = await engine.embed(
				{ input: "test" },
				{ provider: "flaky-e", maxRetries: 2, initialDelayMs: 0 },
			);
			expect(res.vector).toEqual([0.9]);
		});

		it("falls back in embed", async () => {
			const primary = new MockProvider("p1", [], [[-1]]);
			const secondary = new MockProvider("p2", [], [[0.3]]);
			engine.register(primary);
			engine.register(secondary);
			const res = await engine.embed(
				{ input: "test" },
				{ provider: "p1", fallbackProvider: "p2", maxRetries: 0 },
			);
			expect(res.vector).toEqual([0.3]);
		});
	});
});
