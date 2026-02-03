import { describe, expect, mock, test } from "bun:test";
import { OllamaProvider } from "./ollama";

describe("OllamaProvider", () => {
	const provider = new OllamaProvider();

	test("complete() sends correct request", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.model).toBe("qwen2.5-coder:14b");
			return Promise.resolve(
				new Response(
					JSON.stringify({
						message: { content: "hello" },
						prompt_eval_count: 5,
						eval_count: 5,
					}),
				),
			);
		});

		const res = await provider.complete({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(res.content).toBe("hello");
		expect(res.usage?.totalTokens).toBe(10);
	});

	test("complete() throws on error", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(new Response("Error", { status: 500 })),
		);
		await expect(provider.complete({ messages: [] })).rejects.toThrow(
			"Ollama error (500): Error",
		);
	});

	test("embed() sends correct request", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.input).toBe("test input");
			return Promise.resolve(
				new Response(
					JSON.stringify({
						embeddings: [[0.1, 0.2]],
					}),
				),
			);
		});

		const res = await provider.embed({ input: "test input" });
		expect(res.embeddings[0]).toEqual([0.1, 0.2]);
	});

	test("embed() throws on error", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(new Response("Embed Error", { status: 404 })),
		);
		await expect(provider.embed({ input: "test" })).rejects.toThrow(
			"Ollama embed error (404): Embed Error",
		);
	});
});
