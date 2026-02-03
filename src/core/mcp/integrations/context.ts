/**
 * Context Command MCP Integration
 * Provides MCP resource discovery for the context engine.
 */
// This would be integrated into src/features/context/execute.ts

import type { Database } from "bun:sqlite";
import type { McpResource } from "../types";

/**
 * Integration point for Context command
 * Note: This helper reads metadata from the MCP registry table
 * without requiring servers to run. Tests rely on this lightweight path.
 */
export async function getMcpResourcesForContext(
	db: Database,
): Promise<McpResource[]> {
	try {
		const rows = db
			.query(
				`
        SELECT id, name, package FROM mcp_servers WHERE enabled = 1
      `,
			)
			.all();

		return rows.map((row: any) => ({
			id: row.id,
			name: row.name,
			package: row.package,
			uri: `mcp://${row.name}`, // Provide a default URI
		}));
	} catch (error) {
		console.warn("No MCP resources available:", error);
		return [];
	}
}
