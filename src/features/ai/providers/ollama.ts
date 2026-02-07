import type {
	AiEmbeddingRequest,
	AiEmbeddingResponse,
	AiProvider,
	AiRequest,
	AiResponse,
	AiStreamChunk,
} from "../types";

export class OllamaProvider implements AiProvider {
	readonly name = "ollama";

	async complete(request: AiRequest): Promise<AiResponse> {
		const endpoint = process.env.NOOA_AI_ENDPOINT || "http://localhost:11434";
		const model =
			request.model || process.env.NOOA_AI_MODEL || "qwen2.5-coder:14b";

		const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				messages: request.messages,
				stream: false,
				options: {
					temperature: request.temperature,
					num_predict: request.maxTokens,
				},
			}),
		});

		if (!res.ok) {
			const error = await res.text();
			throw new Error(`Ollama error (${res.status}): ${error}`);
		}

		const data = (await res.json()) as {
			message: { content: string };
			prompt_eval_count?: number;
			eval_count?: number;
		};

		return {
			content: data.message.content,
			model,
			provider: this.name,
			usage: {
				promptTokens: data.prompt_eval_count || 0,
				completionTokens: data.eval_count || 0,
				totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
			},
		};
	}

	async *stream(
		request: AiRequest,
	): AsyncGenerator<AiStreamChunk, AiResponse, void> {
		const endpoint = process.env.NOOA_AI_ENDPOINT || "http://localhost:11434";
		const model =
			request.model || process.env.NOOA_AI_MODEL || "qwen2.5-coder:14b";

		const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				messages: request.messages,
				stream: true,
				options: {
					temperature: request.temperature,
					num_predict: request.maxTokens,
				},
			}),
		});

		if (!res.ok || !res.body) {
			const error = await res.text();
			throw new Error(`Ollama error (${res.status}): ${error}`);
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
				if (!line.trim()) continue;
				const data = JSON.parse(line) as {
					message?: { content?: string };
					done?: boolean;
					prompt_eval_count?: number;
					eval_count?: number;
				};
				const delta = data.message?.content;
				if (delta) {
					content += delta;
					yield { content: delta };
				}
				if (data.done) {
					usage = {
						promptTokens: data.prompt_eval_count || 0,
						completionTokens: data.eval_count || 0,
						totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
					};
					return {
						content,
						model,
						provider: this.name,
						usage,
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
		const endpoint = process.env.NOOA_AI_ENDPOINT || "http://localhost:11434";
		const model =
			request.model || process.env.NOOA_AI_EMBED_MODEL || "nomic-embed-text";

		const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/embed`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				input: request.input,
			}),
		});

		if (!res.ok) {
			const error = await res.text();
			throw new Error(`Ollama embed error (${res.status}): ${error}`);
		}

		const data = (await res.json()) as {
			embeddings: number[][];
		};

		return {
			embeddings: data.embeddings,
			model,
			provider: this.name,
		};
	}
}
