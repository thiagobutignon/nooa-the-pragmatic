import type { Registry } from "./Registry";
import type { ServerManager } from "./ServerManager";
import type { McpTool } from "./types";

interface ToolExecutionRequest {
	mcpSource: string;
	name: string;
	args: any;
}

export class ToolProvider {
	constructor(
		private registry: Registry,
		private serverManager: ServerManager,
	) {}

	async getAvailableTools(): Promise<Array<McpTool & { source: string }>> {
		const enabled = await this.registry.listEnabled();
		const toolsPromises = enabled.map(async (server) => {
			try {
				// Ensure server is running
				let client = this.serverManager.getClient(server.name);
				if (!client || !client.isRunning()) {
					client = await this.serverManager.start(server);
				}

				const tools = await client.listTools();
				return tools.map((tool: McpTool) => ({
					...tool,
					source: server.name,
				}));
			} catch (error) {
				console.error(`Failed to get tools from ${server.name}:`, error);
				return [];
			}
		});

		const toolsArrays = await Promise.all(toolsPromises);
		return toolsArrays.flat();
	}

	async executeTool(request: ToolExecutionRequest): Promise<any> {
		const server = await this.registry.get(request.mcpSource);
		if (!server) {
			throw new Error(`MCP server not found: ${request.mcpSource}`);
		}

		//Ensure server is running
		let client = this.serverManager.getClient(server.name);
		if (!client || !client.isRunning()) {
			client = await this.serverManager.start(server);
		}

		return await client.callTool(request.name, request.args);
	}
}
