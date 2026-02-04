export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
	role: AiRole;
	content: string;
}

export interface AiRequest {
	messages: AiMessage[];
	model?: string;
	temperature?: number;
	maxTokens?: number;
	traceId?: string;
}

export interface AiResponse {
	content: string;
	model: string;
	provider: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export interface AiStreamChunk {
	content?: string;
	done?: boolean;
	usage?: AiResponse["usage"];
}

export interface AiEmbeddingRequest {
	input: string | string[];
	model?: string;
}

export interface AiEmbeddingResponse {
	embeddings: number[][];
	model: string;
	provider: string;
}

export interface AiProvider {
	readonly name: string;
	complete(request: AiRequest): Promise<AiResponse>;
	stream?(request: AiRequest): AsyncGenerator<AiStreamChunk, AiResponse, void>;
	embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse>;
}

export interface AiEngineOptions {
	provider?: string;
	model?: string;
	maxRetries?: number;
	initialDelayMs?: number;
	fallbackProvider?: string;
}
