// Placeholder integration for Context command to use MCP resources
// This would be integrated into src/features/context/execute.ts

import type { Database } from "bun:sqlite";
import { Registry } from "../../core/mcp/Registry";
import { ServerManager } from "../../core/mcp/ServerManager";

/**
 * Integration point for Context command
 * Call this to get MCP resources available for context gathering
 */
export async function getMcpResourcesForContext(db: Database): Promise<any[]> {
	const registry = new Registry(db);
	const configStore = registry.configStore;
	const serverManager = new ServerManager(configStore);

	const enabledServers = await registry.listEnabled();
	const allResources: any[] = [];

	for (const server of enabledServers) {
		try {
			let client = serverManager.getClient(server.name);
			if (!client || !client.isRunning()) {
				client = await serverManager.start(server);
			}

			const resources = await client.listResources();
			allResources.push(
				...resources.map((r: any) => ({ ...r, source: server.name })),
			);
		} catch (error) {
			console.error(`Failed to get resources from ${server.name}:`, error);
		}
	}

	return allResources;
}

/**
 * Read an MCP resource from Context command
 */
export async function readMcpResourceFromContext(
	db: Database,
	mcpSource: string,
	uri: string,
): Promise<any> {
	const registry = new Registry(db);
	const configStore = registry.configStore;
	const serverManager = new ServerManager(configStore);

	const server = await registry.get(mcpSource);
	if (!server) {
		throw new Error(`MCP server not found: ${mcpSource}`);
	}

	let client = serverManager.getClient(server.name);
	if (!client || !client.isRunning()) {
		client = await serverManager.start(server);
	}

	return await client.readResource(uri);
}
