import type { Database } from "bun:sqlite";
import { createMcpServersTable } from "../db/schema/mcp_servers";
import type { McpServer } from "./types";

type ServerRow = {
	id: string;
	name: string;
	package: string | null;
	command: string;
	args: string;
	env: string | null;
	enabled: number;
	installed_at: number | null;
	updated_at: number | null;
};

function parseStringArray(raw: string): string[] {
	const parsed: unknown = JSON.parse(raw);
	return Array.isArray(parsed) &&
		parsed.every((item) => typeof item === "string")
		? parsed
		: [];
}

function parseEnv(raw: string | null): Record<string, string> | undefined {
	if (!raw) return undefined;
	const parsed: unknown = JSON.parse(raw);
	if (!parsed || typeof parsed !== "object") return undefined;
	const env = Object.entries(parsed).filter(
		([key, value]) => typeof key === "string" && typeof value === "string",
	);
	return Object.fromEntries(env);
}

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
			.get(name) as ServerRow | null;

		if (!row) return undefined;

		return this.rowToServer(row);
	}

	async listAll(): Promise<McpServer[]> {
		const rows = this.db
			.query("SELECT * FROM mcp_servers")
			.all() as ServerRow[];
		return rows.map((row) => this.rowToServer(row));
	}

	async delete(name: string): Promise<void> {
		this.db.run("DELETE FROM mcp_servers WHERE name = ?", [name]);
	}

	private rowToServer(row: ServerRow): McpServer {
		return {
			id: row.id,
			name: row.name,
			package: row.package || undefined,
			command: row.command,
			args: parseStringArray(row.args),
			env: parseEnv(row.env),
			enabled: row.enabled === 1,
			installedAt: row.installed_at || undefined,
			updatedAt: row.updated_at || undefined,
		};
	}
}
