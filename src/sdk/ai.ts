import { createTraceId } from "../core/logger";
import { openMcpDatabase } from "../core/mcp/db";
import { executeMcpToolFromAi } from "../core/mcp/integrations/ai";
import { AiEngine } from "../features/ai/engine";
import { MockProvider, OllamaProvider, OpenAiProvider } from "../features/ai/providers/mod";
import type { AiResponse } from "../features/ai/types";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface AiRunInput {
	prompt?: string;
	provider?: string;
	model?: string;
	mcpSource?: string;
	mcpTool?: string;
	mcpArgs?: Record<string, unknown>;
}

export type AiRunResult =
	| {
			type: "completion";
			response: AiResponse;
	  }
	| {
			type: "mcp";
			server: string;
			tool: string;
			result: unknown;
	  };

export async function run(input: AiRunInput): Promise<SdkResult<AiRunResult>> {
	if (!input.prompt && !(input.mcpSource && input.mcpTool)) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Prompt is required.", {
				field: "prompt",
			}),
		};
	}

	if ((input.mcpSource && !input.mcpTool) || (!input.mcpSource && input.mcpTool)) {
		return {
			ok: false,
			error: sdkError(
				"invalid_input",
				"mcpSource and mcpTool must be provided together.",
			),
		};
	}

	if (input.mcpSource && input.mcpTool) {
		const db = openMcpDatabase();
		try {
			const result = await executeMcpToolFromAi(
				db,
				input.mcpSource,
				input.mcpTool,
				input.mcpArgs ?? {},
			);
			return {
				ok: true,
				data: {
					type: "mcp",
					server: input.mcpSource,
					tool: input.mcpTool,
					result,
				},
			};
		} catch (error) {
			return {
				ok: false,
				error: sdkError("mcp_error", "Failed to execute MCP tool.", {
					message: error instanceof Error ? error.message : String(error),
				}),
			};
		} finally {
			db.close();
		}
	}

	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new MockProvider());

	try {
		const response = await engine.complete(
			{
				messages: [{ role: "user", content: input.prompt ?? "" }],
				model: input.model,
				traceId: createTraceId(),
			},
			{
				provider: input.provider,
				fallbackProvider: input.provider ? undefined : "openai",
			},
		);
		return {
			ok: true,
			data: {
				type: "completion",
				response,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ai_error", "AI request failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const ai = {
	run,
};
