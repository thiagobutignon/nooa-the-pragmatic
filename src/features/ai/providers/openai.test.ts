import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { OpenAiProvider } from "./openai";

describe("OpenAiProvider", () => {
	const provider = new OpenAiProvider();
	const originalApiKey = process.env.OPENAI_API_KEY;

	beforeAll(() => {
		process.env.OPENAI_API_KEY = "test-key";
	});

	afterAll(() => {
		process.env.OPENAI_API_KEY = originalApiKey;
	});

	test("complete() sends correct request", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.model).toBe("gpt-4o-mini");
			expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
			return Promise.resolve(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "hello" } }],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
					}),
				),
			);
		});

		const res = await provider.complete({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(res.content).toBe("hello");
		expect(res.usage?.totalTokens).toBe(2);
	});

	test("complete() throws on missing API key", async () => {
		process.env.OPENAI_API_KEY = "";
		await expect(provider.complete({ messages: [] })).rejects.toThrow(
			"OpenAI API key not found",
		);
		process.env.OPENAI_API_KEY = "test-key";
	});

	test("complete() throws on non-ok response", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(new Response("Bad Request", { status: 400 })),
		);
		await expect(provider.complete({ messages: [] })).rejects.toThrow(
			"OpenAI error (400): Bad Request",
		);
	});

	test("complete() throws when no choices returned", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(new Response(JSON.stringify({ choices: [] }))),
		);
		await expect(provider.complete({ messages: [] })).rejects.toThrow(
			"OpenAI returned no choices",
		);
	});

	test("embed() sends correct request", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.input).toBe("test");
			return Promise.resolve(
				new Response(
					JSON.stringify({
						data: [{ embedding: [0.1, 0.2] }],
					}),
				),
			);
		});

		const res = await provider.embed({ input: "test" });
		expect(res.embeddings[0]).toEqual([0.1, 0.2]);
	});
});
