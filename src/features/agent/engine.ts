import { join } from "node:path";
import type { SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { AgentLoop, type AgentModelProvider } from "../../runtime/agent/loop";
import { AiEngineAgentProvider } from "../../runtime/agent/provider";
import { SessionManager } from "../../runtime/session/manager";
import { ToolRegistry } from "../../runtime/tool-registry";
import { AiEngine } from "../ai/engine";
import { GroqProvider } from "../ai/providers/groq";
import { MockProvider } from "../ai/providers/mock";
import { OllamaProvider } from "../ai/providers/ollama";
import { OpenAiProvider } from "../ai/providers/openai";

export interface AgentRunInput {
	prompt?: string;
	sessionKey?: string;
	workspace?: string;
	maxIterations?: number;
	json?: boolean;
	provider?: AgentModelProvider;
}

export interface AgentRunResult {
	sessionKey: string;
	content: string;
}

function createAiEngine(): AiEngine {
	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new GroqProvider());
	engine.register(new MockProvider());
	return engine;
}

function createDefaultProvider(): AgentModelProvider {
	return new AiEngineAgentProvider(createAiEngine());
}

export async function run(
	input: AgentRunInput,
): Promise<SdkResult<AgentRunResult>> {
	if (!input.prompt || input.prompt.trim().length === 0) {
		return {
			ok: false,
			error: sdkError("agent.missing_prompt", "Prompt is required."),
		};
	}

	const workspace = input.workspace ?? process.cwd();
	const sessionKey = input.sessionKey ?? "cli:direct";
	const sessionStore = join(workspace, ".nooa", "sessions");
	const sessions = new SessionManager(sessionStore);

	const loop = new AgentLoop({
		provider: input.provider ?? createDefaultProvider(),
		tools: new ToolRegistry({ enableCommandGuard: true }),
		sessions,
		workspace,
		maxIterations: input.maxIterations,
	});

	const result = await loop.processMessage(sessionKey, input.prompt);
	if (result.isError) {
		return {
			ok: false,
			error: sdkError("agent.runtime_error", result.forLlm),
		};
	}

	return {
		ok: true,
		data: {
			sessionKey,
			content: result.forLlm,
		},
	};
}
