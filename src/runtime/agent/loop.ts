import { ContextBuilder } from "../context/builder";
import type { SessionManager } from "../session/manager";
import type { ToolRegistry } from "../tool-registry";
import { errorResult, type ToolResult, toolResult } from "../types";

export interface AgentToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface AgentModelMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
}

export interface AgentModelResponse {
	content: string;
	toolCalls: AgentToolCall[];
}

export interface AgentModelProvider {
	generate(input: {
		messages: AgentModelMessage[];
	}): Promise<AgentModelResponse>;
}

export interface AgentLoopOptions {
	provider: AgentModelProvider;
	tools: ToolRegistry;
	sessions: SessionManager;
	workspace: string;
	maxIterations?: number;
}

export class AgentLoop {
	private readonly provider: AgentModelProvider;
	private readonly tools: ToolRegistry;
	private readonly sessions: SessionManager;
	private readonly context: ContextBuilder;
	private readonly maxIterations: number;

	constructor(options: AgentLoopOptions) {
		this.provider = options.provider;
		this.tools = options.tools;
		this.sessions = options.sessions;
		this.context = new ContextBuilder(options.workspace, options.tools);
		this.maxIterations = options.maxIterations ?? 5;
	}

	async processMessage(
		sessionKey: string,
		userInput: string,
	): Promise<ToolResult> {
		this.sessions.getOrCreate(sessionKey);
		this.sessions.addMessage(sessionKey, "user", userInput);

		const nextInput = "";
		for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
			const messages = await this.context.buildMessages(
				this.sessions.getHistory(sessionKey),
				nextInput,
				this.sessions.getSummary(sessionKey),
			);

			const response = await this.provider.generate({ messages });

			if (response.content.trim().length > 0) {
				this.sessions.addMessage(sessionKey, "assistant", response.content);
			}

			if (response.toolCalls.length === 0) {
				await this.sessions.save(sessionKey);
				const content = response.content.trim();
				return toolResult(
					content.length > 0 ? content : "Assistant returned no content.",
				);
			}

			for (const toolCall of response.toolCalls) {
				const toolOutput = await this.tools.execute(
					toolCall.name,
					toolCall.arguments,
				);
				this.sessions.addMessage(
					sessionKey,
					"tool",
					`tool:${toolCall.name} ${toolOutput.forLlm}`,
				);
			}
		}

		await this.sessions.save(sessionKey);
		return errorResult(
			`Agent loop reached max iterations (${this.maxIterations}) without a final response.`,
		);
	}
}
