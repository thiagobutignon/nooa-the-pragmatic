// Placeholder integration for AI command to use MCP tools
// This would be integrated into src/features/ai/execute.ts

import type { Database } from "bun:sqlite";
import { Registry } from "../../core/mcp/Registry";
import { ServerManager } from "../../core/mcp/ServerManager";
import { ToolProvider } from "../../core/mcp/ToolProvider";

/**
 * Integration point for AI command
 * Call this to get MCP tools available for AI usage
 */
export async function getMcpToolsForAi(db: Database): Promise<any[]> {
	const registry = new Registry(db);
	const configStore = registry.configStore;
	const serverManager = new ServerManager(configStore);
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
	args: any,
): Promise<any> {
	const registry = new Registry(db);
	const configStore = registry.configStore;
	const serverManager = new ServerManager(configStore);
	const toolProvider = new ToolProvider(registry, serverManager);

	return await toolProvider.executeTool({
		mcpSource,
		name: toolName,
		args,
	});
}
