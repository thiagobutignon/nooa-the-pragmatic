import { describe, expect, it, mock, beforeEach } from "bun:test";
import { AiEngine } from "../../../src/features/ai/engine";
import type { AiProvider, AiRequest, AiResponse } from "../../../src/features/ai/types";

describe("AiEngine", () => {
    let engine: AiEngine;
    let mockProvider: AiProvider;
    let mockFallbackProvider: AiProvider;

    beforeEach(() => {
        engine = new AiEngine();
        mockProvider = {
            name: "mock-main",
            complete: mock(async () => ({ content: "success", usage: { total: 10 } })),
            embed: mock(async () => ({ embeddings: [[0.1]], usage: { total: 10 } })),
            stream: mock(async function* () { yield { content: "chunk" }; }),
        };
        mockFallbackProvider = {
            name: "mock-fallback",
            complete: mock(async () => ({ content: "fallback success", usage: { total: 10 } })),
            embed: mock(async () => ({ embeddings: [[0.2]], usage: { total: 10 } })),
            stream: mock(async function* () { yield { content: "fallback chunk" }; }),
        };

        engine.register(mockProvider);
        engine.register(mockFallbackProvider);
    });

    it("should complete successfully with default provider", async () => {
        const result = await engine.complete({ prompt: "hello" }, { provider: "mock-main" });
        expect(result.content).toBe("success");
        expect(mockProvider.complete).toHaveBeenCalled();
    });

    it("should throw if provider not found", async () => {
        expect(engine.complete({ prompt: "hello" }, { provider: "missing" }))
            .rejects.toThrow("AI Provider not found");
    });

    it("should retry on failure", async () => {
        const error = new Error("fail");
        (mockProvider.complete as any).mockRejectedValueOnce(error);
        (mockProvider.complete as any).mockResolvedValueOnce({ content: "retry success" });

        const result = await engine.complete(
            { prompt: "hello" },
            { provider: "mock-main", maxRetries: 1, initialDelayMs: 1 }
        );

        expect(result.content).toBe("retry success");
        expect(mockProvider.complete).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries", async () => {
        (mockProvider.complete as any).mockRejectedValue(new Error("fail"));

        expect(engine.complete(
            { prompt: "hello" },
            { provider: "mock-main", maxRetries: 2, initialDelayMs: 1 }
        )).rejects.toThrow("fail");

        expect(mockProvider.complete).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should use fallback on failure", async () => {
        (mockProvider.complete as any).mockRejectedValue(new Error("fail"));

        const result = await engine.complete(
            { prompt: "hello" },
            {
                provider: "mock-main",
                fallbackProvider: "mock-fallback",
                maxRetries: 0
            }
        );

        expect(result.content).toBe("fallback success");
        expect(mockProvider.complete).toHaveBeenCalled();
        expect(mockFallbackProvider.complete).toHaveBeenCalled();
    });

    it("should stream successfully", async () => {
        const generator = engine.stream({ prompt: "hello" }, { provider: "mock-main" });
        const chunks = [];
        for await (const chunk of generator) {
            chunks.push(chunk);
        }
        expect(chunks).toHaveLength(1);
        expect(chunks[0].content).toBe("chunk");
    });

    it("should falback stream", async () => {
        (mockProvider.stream as any).mockImplementationOnce(() => { throw new Error("stream fail"); });

        const generator = engine.stream(
            { prompt: "hello" },
            { provider: "mock-main", fallbackProvider: "mock-fallback" }
        );

        const chunks = [];
        for await (const chunk of generator) {
            chunks.push(chunk);
        }
        expect(chunks[0].content).toBe("fallback chunk");
    });

    it("should embed successfully", async () => {
        const res = await engine.embed({ input: "hello" }, { provider: "mock-main" });
        expect(res.embeddings[0][0]).toBe(0.1);
    });

    it("should fallback embed", async () => {
        (mockProvider.embed as any).mockRejectedValue(new Error("fail"));
        const res = await engine.embed(
            { input: "hello" },
            { provider: "mock-main", fallbackProvider: "mock-fallback", maxRetries: 0 }
        );
        expect(res.embeddings[0][0]).toBe(0.2);
    });
});
