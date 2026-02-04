import type {
	AiEmbeddingRequest,
	AiEmbeddingResponse,
	AiProvider,
	AiRequest,
	AiResponse,
	AiStreamChunk,
} from "../types";

export class MockProvider implements AiProvider {
	readonly name = "mock";

	async complete(request: AiRequest): Promise<AiResponse> {
		if (process.env.NOOA_AI_MOCK_CONTENT) {
			return {
				content: process.env.NOOA_AI_MOCK_CONTENT,
				model: "mock-model",
				provider: this.name,
				usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
			};
		}
		const lastMessage = request.messages[request.messages.length - 1];
		const input = lastMessage?.content || "";

		let content = `Simulated response for: ${input}`;
		if (input.toLowerCase().includes("json")) {
			content = JSON.stringify(
				{
					schemaVersion: "1.0",
					ok: true,
					summary: "This is a simulated review summary.",
					findings: [
						{
							severity: "low",
							file: "unknown",
							line: 1,
							category: "style",
							message: "Simulated finding",
							suggestion: "Fix it",
						},
					],
					stats: { files: 1, findings: 1 },
				},
				null,
				2,
			);
		}

		return {
			content,
			model: request.model || "mock-model",
			provider: this.name,
			usage: {
				promptTokens: 10,
				completionTokens: 20,
				totalTokens: 30,
			},
		};
	}

	async *stream(request: AiRequest): AsyncGenerator<AiStreamChunk, AiResponse, void> {
		const response = await this.complete(request);
		const chunks = response.content.split(/\s+/);
		for (const chunk of chunks) {
			yield { content: `${chunk} ` };
			await new Promise((resolve) => setTimeout(resolve, 15));
		}
		return response;
	}

	async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
		const inputs = Array.isArray(request.input)
			? request.input
			: [request.input];
		const embeddings = inputs.map(() =>
			Array.from({ length: 1536 }, () => Math.random()),
		);

		return {
			embeddings,
			model: request.model || "mock-embedding-model",
			provider: this.name,
		};
	}
}
