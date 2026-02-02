import { Database } from "bun:sqlite";

export const DEFAULT_MCP_DB_PATH = process.env.NOOA_DB_PATH || "nooa.db";

export function openMcpDatabase(path?: string): Database {
	return new Database(path ?? DEFAULT_MCP_DB_PATH);
}
