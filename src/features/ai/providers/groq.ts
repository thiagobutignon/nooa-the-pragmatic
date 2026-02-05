import type {
    AiEmbeddingRequest,
    AiEmbeddingResponse,
    AiProvider,
    AiRequest,
    AiResponse,
    AiStreamChunk,
} from "../types";

export class GroqProvider implements AiProvider {
    readonly name = "groq";

    async complete(request: AiRequest): Promise<AiResponse> {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY not found in environment");
        }

        // Map models if needed, or default to a safe choice
        const model =
            request.model === "qwen2.5-coder:14b" || request.model === "qwen2.5-coder"
                ? "llama-3.3-70b-versatile"
                : request.model || "llama-3.3-70b-versatile";

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: request.messages,
                stream: false,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
            }),
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Groq error (${res.status}): ${error}`);
        }

        const data = (await res.json()) as {
            choices: { message: { content: string } }[];
            usage: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
            };
        };

        return {
            content: data.choices[0]?.message.content || "",
            model,
            provider: this.name,
            usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            },
        };
    }

    async *stream(request: AiRequest): AsyncGenerator<AiStreamChunk, AiResponse, void> {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY not found in environment");
        }

        const model =
            request.model === "qwen2.5-coder:14b" || request.model === "qwen2.5-coder"
                ? "llama-3.3-70b-versatile"
                : request.model || "llama-3.3-70b-versatile";

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: request.messages,
                stream: true,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
            }),
        });

        if (!res.ok || !res.body) {
            const error = await res.text();
            throw new Error(`Groq error (${res.status}): ${error}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";
        // Groq doesn't always send usage in stream unless specified options, 
        // but OpenAI format usually sends a final chunk with usage.
        // For simplicity we might miss precise usage in stream
        let usage: AiResponse["usage"] | undefined;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === "data: [DONE]") continue;
                if (trimmed.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        const delta = data.choices[0]?.delta?.content;
                        if (delta) {
                            content += delta;
                            yield { content: delta };
                        }
                        if (data.usage) {
                            usage = {
                                promptTokens: data.usage.prompt_tokens,
                                completionTokens: data.usage.completion_tokens,
                                totalTokens: data.usage.total_tokens,
                            };
                        }
                    } catch (e) {
                        // Ignore parse errors for partial chunks
                    }
                }
            }
        }

        return {
            content,
            model,
            provider: this.name,
            usage: usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
    }

    async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
        // Groq doesn't support embeddings natively yet (or at least consistent with OpenAI endpoint)
        // Throwing error to force fallback
        throw new Error("Groq does not support embeddings yet.");
    }
}
