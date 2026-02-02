import type { Database } from "bun:sqlite";

export function createMcpAliasesTable(db: Database) {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS mcp_aliases (
      name TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      args TEXT,
      env TEXT,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
    `,
  );
}
