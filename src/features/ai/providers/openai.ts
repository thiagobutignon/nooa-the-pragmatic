import type {
	AiEmbeddingRequest,
	AiEmbeddingResponse,
	AiProvider,
	AiRequest,
	AiResponse,
	AiStreamChunk,
} from "../types";

export class OpenAiProvider implements AiProvider {
	readonly name = "openai";

	async complete(request: AiRequest): Promise<AiResponse> {
		const apiKey = this.getApiKey();
		if (!apiKey) {
			throw new Error(
				"OpenAI API key not found (OPENAI_API_KEY or NVIDIA_API_KEY)",
			);
		}

		const model = this.resolveModel(request);

		const res = await this.fetchWithTimeout(
			`${this.baseUrl()}/chat/completions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: request.messages,
					temperature: request.temperature,
					top_p: this.resolveTopP(request),
					max_tokens: request.maxTokens,
					chat_template_kwargs: this.resolveChatTemplateKwargs(),
				}),
			},
			"chat completion",
		);

		if (!res.ok) {
			const error = await res.text();
			throw new Error(`OpenAI error (${res.status}): ${error}`);
		}

		const data = (await res.json()) as {
			choices: { message: { content: string } }[];
			usage?: {
				prompt_tokens: number;
				completion_tokens: number;
				total_tokens: number;
			};
		};

		if (!data.choices || data.choices.length === 0 || !data.choices[0]) {
			throw new Error("OpenAI returned no choices");
		}

		const usage = data.usage;
		return {
			content: data.choices[0].message.content,
			model,
			provider: this.name,
			usage: usage
				? {
						promptTokens: usage.prompt_tokens,
						completionTokens: usage.completion_tokens,
						totalTokens: usage.total_tokens,
					}
				: undefined,
		};
	}

	async *stream(
		request: AiRequest,
	): AsyncGenerator<AiStreamChunk, AiResponse, void> {
		const apiKey = this.getApiKey();
		if (!apiKey) {
			throw new Error(
				"OpenAI API key not found (OPENAI_API_KEY or NVIDIA_API_KEY)",
			);
		}

		const model = this.resolveModel(request);

		const res = await this.fetchWithTimeout(
			`${this.baseUrl()}/chat/completions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: request.messages,
					temperature: request.temperature,
					top_p: this.resolveTopP(request),
					max_tokens: request.maxTokens,
					stream: true,
					stream_options: { include_usage: true },
					chat_template_kwargs: this.resolveChatTemplateKwargs(),
				}),
			},
			"chat stream",
		);

		if (!res.ok || !res.body) {
			const error = await res.text();
			throw new Error(`OpenAI error (${res.status}): ${error}`);
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let content = "";
		let usage: AiResponse["usage"] | undefined;

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const payload = trimmed.slice(5).trim();
				if (payload === "[DONE]") {
					return {
						content,
						model,
						provider: this.name,
						usage,
					};
				}
				const data = JSON.parse(payload) as {
					choices?: {
						delta?: { content?: string; reasoning_content?: string };
					}[];
					usage?: {
						prompt_tokens: number;
						completion_tokens: number;
						total_tokens: number;
					};
				};
				if (data.usage) {
					usage = {
						promptTokens: data.usage.prompt_tokens,
						completionTokens: data.usage.completion_tokens,
						totalTokens: data.usage.total_tokens,
					};
				}
				const deltaContent = data.choices?.[0]?.delta?.content;
				const deltaReasoning = data.choices?.[0]?.delta?.reasoning_content;
				if (deltaContent || deltaReasoning) {
					if (deltaContent) {
						content += deltaContent;
					}
					yield {
						content: deltaContent,
						reasoningContent: deltaReasoning,
					};
				}
			}
		}

		return {
			content,
			model,
			provider: this.name,
			usage,
		};
	}

	async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
		const apiKey = this.getApiKey();
		if (!apiKey) {
			throw new Error(
				"OpenAI API key not found (OPENAI_API_KEY or NVIDIA_API_KEY)",
			);
		}

		const model = request.model || "text-embedding-3-small";

		const res = await this.fetchWithTimeout(
			`${this.baseUrl()}/embeddings`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					input: request.input,
				}),
			},
			"embeddings",
		);

		if (!res.ok) {
			const error = await res.text();
			throw new Error(`OpenAI embed error (${res.status}): ${error}`);
		}

		const data = (await res.json()) as {
			data: { embedding: number[] }[];
		};

		return {
			embeddings: data.data.map((d) => d.embedding),
			model,
			provider: this.name,
		};
	}

	private baseUrl(): string {
		const base = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
		return base.replace(/\/$/, "");
	}

	private resolveModel(request: AiRequest): string {
		return request.model || process.env.NOOA_AI_MODEL || "gpt-4o-mini";
	}

	private resolveTopP(request: AiRequest): number | undefined {
		if (typeof request.topP === "number") return request.topP;
		const raw = process.env.NOOA_AI_TOP_P;
		if (!raw) return undefined;
		const parsed = Number.parseFloat(raw);
		if (!Number.isFinite(parsed)) return undefined;
		return parsed;
	}

	private resolveChatTemplateKwargs():
		| { enable_thinking?: boolean; clear_thinking?: boolean }
		| undefined {
		const enableThinking = this.parseBooleanEnv("OPENAI_ENABLE_THINKING");
		const clearThinking = this.parseBooleanEnv("OPENAI_CLEAR_THINKING");
		if (enableThinking === undefined && clearThinking === undefined) {
			return undefined;
		}
		return {
			enable_thinking: enableThinking,
			clear_thinking: clearThinking,
		};
	}

	private getApiKey(): string | undefined {
		return process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
	}

	private timeoutMs(): number {
		const raw = process.env.OPENAI_TIMEOUT_MS;
		if (!raw) return 30000;
		const parsed = Number.parseInt(raw, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
	}

	private parseBooleanEnv(name: string): boolean | undefined {
		const raw = process.env[name];
		if (!raw) return undefined;
		const value = raw.trim().toLowerCase();
		if (value === "1" || value === "true" || value === "yes") return true;
		if (value === "0" || value === "false" || value === "no") return false;
		return undefined;
	}

	private async fetchWithTimeout(
		url: string,
		init: RequestInit,
		operation: string,
	): Promise<Response> {
		const timeoutMs = this.timeoutMs();
		try {
			return await fetch(url, {
				...init,
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			if (error instanceof Error && error.name === "TimeoutError") {
				throw new Error(`OpenAI ${operation} timed out after ${timeoutMs}ms`);
			}
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new Error(`OpenAI ${operation} timed out after ${timeoutMs}ms`);
			}
			throw error;
		}
	}
}
