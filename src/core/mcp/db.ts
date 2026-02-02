import { Database } from "bun:sqlite";

function getDefaultMcpDbPath(): string {
	return process.env.NOOA_DB_PATH || "nooa.db";
}

export function openMcpDatabase(path?: string): Database {
	return new Database(path ?? getDefaultMcpDbPath());
}
