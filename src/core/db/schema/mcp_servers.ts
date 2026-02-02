import type { Database } from "bun:sqlite";

export function createMcpServersTable(db: Database): void {
	db.run(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      package TEXT,
      command TEXT NOT NULL,
      args TEXT NOT NULL,
      env TEXT,
      enabled INTEGER DEFAULT 1,
      installed_at INTEGER,
      updated_at INTEGER
    )
  `);
}
