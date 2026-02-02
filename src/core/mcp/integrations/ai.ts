// Placeholder integration for AI command to use MCP tools
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
	}
}

/**
 * Execute an MCP tool from AI command
 */
export async function executeMcpToolFromAi(
	db: Database,
	mcpSource: string,
	toolName: string,
	// biome-ignore lint/suspicious/noExplicitAny: Tool args are dynamic JSON-RPC params
	args: any,
	// biome-ignore lint/suspicious/noExplicitAny: Tool result is dynamic JSON-RPC response
): Promise<any> {
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	const toolProvider = new ToolProvider(registry, serverManager);

	return await toolProvider.executeTool({
		mcpSource,
		name: toolName,
		args,
	});
}
