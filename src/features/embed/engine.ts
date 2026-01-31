export type EmbedResult = {
	embedding: number[];
	dimensions: number;
	model: string;
	provider: string;
};

export type ProviderConfig = {
	provider?: string;
	model?: string;
	endpoint?: string;
	apiKey?: string;
};

type ProviderResponse = {
	embedding: number[];
	dimensions: number;
};

type EmbedProvider = {
	name: string;
	embed: (input: string, model: string, config: ProviderConfig) => Promise<ProviderResponse>;
};

const mockProvider: EmbedProvider = {
	name: "mock",
	embed: async (input: string) => {
		const embedding = Array.from({ length: 8 }, (_, i) => (input.length + i) % 7);
		return { embedding, dimensions: 8 };
	},
};

const ollamaProvider: EmbedProvider = {
	name: "ollama",
	embed: async (input, model, config) => {
		const endpoint = config.endpoint ?? process.env.NOOA_EMBED_ENDPOINT ?? "http://localhost:11434";
		const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/embeddings`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ model, prompt: input }),
		});
		if (!res.ok) {
			throw new Error(`Embed provider error: ${res.status} ${res.statusText}`);
		}
		const data = (await res.json()) as { embedding?: number[] };
		if (!data.embedding || !Array.isArray(data.embedding)) {
			throw new Error("Embed provider returned no embedding");
		}
		return { embedding: data.embedding, dimensions: data.embedding.length };
	},
};

export function resolveProvider(config: ProviderConfig): EmbedProvider {
	const provider = config.provider ?? process.env.NOOA_EMBED_PROVIDER ?? "ollama";
	if (provider === "mock") return mockProvider;
	if (provider === "ollama") return ollamaProvider;
	throw new Error("No embed provider configured");
}

export async function embedText(input: string, config: ProviderConfig) {
	const provider = resolveProvider(config);
	const model = config.model ?? process.env.NOOA_EMBED_MODEL ?? "nomic-embed-text";
	const result = await provider.embed(input, model, config);
	return { ...result, model, provider: provider.name } as EmbedResult;
}
