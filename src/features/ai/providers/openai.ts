import type {
    AiEmbeddingRequest,
    AiEmbeddingResponse,
    AiProvider,
    AiRequest,
    AiResponse,
} from "../types";

export class OpenAiProvider implements AiProvider {
	readonly name = "openai";

	async complete(request: AiRequest): Promise<AiResponse> {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OpenAI API key not found (OPENAI_API_KEY)");
		}

		const model = request.model || "gpt-4o-mini";

		const res = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: request.messages,
				temperature: request.temperature,
				max_tokens: request.maxTokens,
			}),
		});

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

	async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OpenAI API key not found (OPENAI_API_KEY)");
		}

		const model = request.model || "text-embedding-3-small";

		const res = await fetch("https://api.openai.com/v1/embeddings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				input: request.input,
			}),
		});

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
}
