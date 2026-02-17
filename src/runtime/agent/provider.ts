import type { AiEngine } from "../../features/ai/engine";
import type { AiMessage } from "../../features/ai/types";
import type {
	AgentModelMessage,
	AgentModelProvider,
	AgentModelResponse,
} from "./loop";

export class AiEngineAgentProvider implements AgentModelProvider {
	constructor(private readonly engine: Pick<AiEngine, "complete">) {}

	async generate(input: {
		messages: AgentModelMessage[];
	}): Promise<AgentModelResponse> {
		const response = await this.engine.complete({
			messages: input.messages.map((message) => this.toAiMessage(message)),
		});

		return {
			content: response.content,
			toolCalls: [],
		};
	}

	private toAiMessage(message: AgentModelMessage): AiMessage {
		if (message.role === "tool") {
			return {
				role: "assistant",
				content: `[tool] ${message.content}`,
			};
		}

		if (message.role === "system") {
			return { role: "system", content: message.content };
		}

		if (message.role === "assistant") {
			return { role: "assistant", content: message.content };
		}

		return { role: "user", content: message.content };
	}
}
