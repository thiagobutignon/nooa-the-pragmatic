import type { AiProvider, AiRequest, AiResponse } from "../types";

export class MockProvider implements AiProvider {
    readonly name = "mock";

    async complete(request: AiRequest): Promise<AiResponse> {
        const lastMessage = request.messages[request.messages.length - 1];
        const input = lastMessage?.content || "";
        return {
            content: `Mock response for: ${input}`,
            model: request.model || "mock-model",
            provider: this.name,
            usage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30,
            },
        };
    }
}
