import type { Database } from "bun:sqlite";
import { createMcpServersTable } from "../db/schema/mcp_servers";
import type { McpServer } from "./types";

export class ConfigStore {
	constructor(private db: Database) {
		createMcpServersTable(db);
	}

	async save(server: McpServer): Promise<void> {
		const now = Date.now();
		const updatedAt = now;
		const installedAt = server.installedAt || now;

		this.db.run(
			`
      INSERT INTO mcp_servers (id, name, package, command, args, env, enabled, installed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        package = excluded.package,
        command = excluded.command,
        args = excluded.args,
        env = excluded.env,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `,
			[
				server.id,
				server.name,
				server.package || null,
				server.command,
				JSON.stringify(server.args),
				server.env ? JSON.stringify(server.env) : null,
				server.enabled ? 1 : 0,
				installedAt,
				updatedAt,
			],
		);
	}

	async get(name: string): Promise<McpServer | undefined> {
		const row = this.db
			.query("SELECT * FROM mcp_servers WHERE name = ?")
			.get(name) as any;

		if (!row) return undefined;

		return this.rowToServer(row);
	}

	async listAll(): Promise<McpServer[]> {
		const rows = this.db.query("SELECT * FROM mcp_servers").all() as any[];
		return rows.map((row) => this.rowToServer(row));
	}

	async delete(name: string): Promise<void> {
		this.db.run("DELETE FROM mcp_servers WHERE name = ?", [name]);
	}

	private rowToServer(row: any): McpServer {
		return {
			id: row.id,
			name: row.name,
			package: row.package || undefined,
			command: row.command,
			args: JSON.parse(row.args),
			env: row.env ? JSON.parse(row.env) : undefined,
			enabled: row.enabled === 1,
			installedAt: row.installed_at || undefined,
			updatedAt: row.updated_at || undefined,
		};
	}
}
