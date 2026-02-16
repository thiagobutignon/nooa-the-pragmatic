/**
 * AI Command MCP Integration
 * Provides MCP tool execution and discovery for the AI engine.
 */
// This would be integrated into src/features/ai/execute.ts

import type { Database } from "bun:sqlite";
import { Registry } from "../Registry";
import { ServerManager } from "../ServerManager";
import { ToolProvider } from "../ToolProvider";
import type { McpTool } from "../types";

/**
 * Integration point for AI command
 * Call this to get MCP tools available for AI usage
 */
export async function getMcpToolsForAi(db: Database): Promise<McpTool[]> {
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	const toolProvider = new ToolProvider(registry, serverManager);

	try {
		const tools = await toolProvider.getAvailableTools();
		return tools;
	} catch (error) {
		console.error("Failed to load MCP tools for AI:", error);
		return [];
	} finally {
		await serverManager.stopAll();
	}
}

/**
 * Execute an MCP tool from AI command
 */
export async function executeMcpToolFromAi(
	db: Database,
	mcpSource: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<unknown> {
	if (process.env.MCP_MOCK_RESPONSE) {
		try {
			return JSON.parse(process.env.MCP_MOCK_RESPONSE);
		} catch (error) {
			console.warn("Invalid MCP_MOCK_RESPONSE:", error);
		}
	}
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	const toolProvider = new ToolProvider(registry, serverManager);

	try {
		return await toolProvider.executeTool({
			mcpSource,
			name: toolName,
			args,
		});
	} finally {
		await serverManager.stopAll();
	}
}
