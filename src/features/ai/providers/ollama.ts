import type { AiProvider, AiRequest, AiResponse } from "../types";

export class OllamaProvider implements AiProvider {
    readonly name = "ollama";

    async complete(request: AiRequest): Promise<AiResponse> {
        const endpoint = process.env.NOOA_AI_ENDPOINT || "http://localhost:11434";
        const model = request.model || process.env.NOOA_AI_MODEL || "qwen2.5-coder:14b";

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
}
