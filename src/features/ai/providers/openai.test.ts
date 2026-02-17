import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { OpenAiProvider } from "./openai";

describe("OpenAiProvider", () => {
	const provider = new OpenAiProvider();
	const originalApiKey = process.env.OPENAI_API_KEY;
	const originalApiBase = process.env.OPENAI_API_BASE;
	const originalNooaAiModel = process.env.NOOA_AI_MODEL;
	const originalOpenAiTimeoutMs = process.env.OPENAI_TIMEOUT_MS;
	const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
	const originalNooaAiTopP = process.env.NOOA_AI_TOP_P;
	const originalEnableThinking = process.env.OPENAI_ENABLE_THINKING;
	const originalClearThinking = process.env.OPENAI_CLEAR_THINKING;

	beforeAll(() => {
		process.env.OPENAI_API_KEY = "test-key";
		process.env.NOOA_AI_MODEL = "";
	});

	afterAll(() => {
		process.env.OPENAI_API_KEY = originalApiKey;
		process.env.OPENAI_API_BASE = originalApiBase;
		process.env.NOOA_AI_MODEL = originalNooaAiModel;
		process.env.OPENAI_TIMEOUT_MS = originalOpenAiTimeoutMs;
		process.env.NVIDIA_API_KEY = originalNvidiaApiKey;
		process.env.NOOA_AI_TOP_P = originalNooaAiTopP;
		process.env.OPENAI_ENABLE_THINKING = originalEnableThinking;
		process.env.OPENAI_CLEAR_THINKING = originalClearThinking;
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

	test("complete() sends top_p and chat_template_kwargs from env", async () => {
		process.env.NOOA_AI_TOP_P = "1";
		process.env.OPENAI_ENABLE_THINKING = "true";
		process.env.OPENAI_CLEAR_THINKING = "false";

		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.top_p).toBe(1);
			expect(body.chat_template_kwargs).toEqual({
				enable_thinking: true,
				clear_thinking: false,
			});
			return Promise.resolve(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "ok" } }],
					}),
				),
			);
		});

		const res = await provider.complete({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(res.content).toBe("ok");

		process.env.NOOA_AI_TOP_P = "";
		process.env.OPENAI_ENABLE_THINKING = "";
		process.env.OPENAI_CLEAR_THINKING = "";
	});

	test("complete() uses OPENAI_API_BASE when configured", async () => {
		process.env.OPENAI_API_BASE = "https://integrate.api.nvidia.com/v1";

		// @ts-expect-error
		global.fetch = mock((url) => {
			expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
			return Promise.resolve(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "hello from nvidia base" } }],
					}),
				),
			);
		});

		const res = await provider.complete({
			messages: [{ role: "user", content: "hi" }],
		});

		expect(res.content).toBe("hello from nvidia base");
		process.env.OPENAI_API_BASE = "";
	});

	test("complete() throws on missing API key", async () => {
		process.env.OPENAI_API_KEY = "";
		process.env.NVIDIA_API_KEY = "";
		await expect(provider.complete({ messages: [] })).rejects.toThrow(
			"OpenAI API key not found",
		);
		process.env.OPENAI_API_KEY = "test-key";
		process.env.NVIDIA_API_KEY = originalNvidiaApiKey;
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

	test("complete() uses NOOA_AI_MODEL when request model is missing", async () => {
		process.env.NOOA_AI_MODEL = "z-ai/glm5";

		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.model).toBe("z-ai/glm5");
			return Promise.resolve(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "model from env" } }],
					}),
				),
			);
		});

		const res = await provider.complete({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(res.content).toBe("model from env");
		process.env.NOOA_AI_MODEL = "";
	});

	test("complete() fails fast when request times out", async () => {
		process.env.OPENAI_TIMEOUT_MS = "20";

		// @ts-expect-error
		global.fetch = mock((_url, init?: RequestInit) => {
			const signal = init?.signal;
			return new Promise<Response>((_resolve, reject) => {
				if (signal instanceof AbortSignal) {
					signal.addEventListener("abort", () => {
						reject(
							new DOMException("The operation was aborted.", "AbortError"),
						);
					});
				}
			});
		});

		await expect(
			provider.complete({
				messages: [{ role: "user", content: "hi" }],
			}),
		).rejects.toThrow("timed out");

		process.env.OPENAI_TIMEOUT_MS = "";
	});

	test("stream() yields reasoning_content and content", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						'data: {"choices":[{"delta":{"reasoning_content":"[thinking]"}}]}\n\n',
					),
				);
				controller.enqueue(
					encoder.encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'),
				);
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			},
		});

		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(
				new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/event-stream" },
				}),
			),
		);

		const iterator = provider.stream({
			messages: [{ role: "user", content: "hi" }],
		});

		const first = await iterator.next();
		expect(first.value?.reasoningContent).toBe("[thinking]");
		const second = await iterator.next();
		expect(second.value?.content).toBe("OK");
	});
});
