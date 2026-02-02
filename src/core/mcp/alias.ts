import type { Database } from "bun:sqlite";
import { createMcpAliasesTable } from "../db/schema/mcp_aliases";

export type McpAlias = {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
};

export class AliasStore {
  constructor(private db: Database) {
    createMcpAliasesTable(db);
  }

  async save(alias: McpAlias): Promise<void> {
    this.db.run(
      `
      INSERT INTO mcp_aliases (name, command, args, env, description)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        command = excluded.command,
        args = excluded.args,
        env = excluded.env,
        description = excluded.description
    `,
      [
        alias.name,
        alias.command,
        alias.args ? JSON.stringify(alias.args) : null,
        alias.env ? JSON.stringify(alias.env) : null,
        alias.description ?? null,
      ],
    );
  }

  async get(name: string): Promise<McpAlias | undefined> {
    const row = this.db
      .query("SELECT * FROM mcp_aliases WHERE name = ?")
      .get(name) as any;
    if (!row) return undefined;
    return this.rowToAlias(row);
  }

  async list(): Promise<McpAlias[]> {
    const rows = this.db.query("SELECT * FROM mcp_aliases").all() as any[];
    return rows.map((row) => this.rowToAlias(row));
  }

  async delete(name: string): Promise<void> {
    this.db.run("DELETE FROM mcp_aliases WHERE name = ?", [name]);
  }

  private rowToAlias(row: any): McpAlias {
    return {
      name: row.name,
      command: row.command,
      args: row.args ? JSON.parse(row.args) : undefined,
      env: row.env ? JSON.parse(row.env) : undefined,
      description: row.description || undefined,
    };
  }
}
