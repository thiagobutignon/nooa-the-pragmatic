import type { Database } from "bun:sqlite";
import { ConfigStore } from "./ConfigStore";
import { ServerManager } from "./ServerManager";
import type { HealthStatus, McpServer } from "./types";
import { AliasStore, type McpAlias } from "./alias";

export class Registry {
	private configStore: ConfigStore;
	private aliasStore: AliasStore;

	constructor(db: Database) {
		this.configStore = new ConfigStore(db);
		this.aliasStore = new AliasStore(db);
	}

	async add(server: McpServer): Promise<void> {
		await this.configStore.save(server);
	}

	async get(name: string): Promise<McpServer | undefined> {
		return await this.configStore.get(name);
	}

	async listAll(): Promise<McpServer[]> {
		return await this.configStore.listAll();
	}

	async listEnabled(): Promise<McpServer[]> {
		const all = await this.listAll();
		return all.filter((s) => s.enabled);
	}

	async enable(name: string): Promise<void> {
		const server = await this.get(name);
		if (server) {
			await this.configStore.save({ ...server, enabled: true });
		}
	}

	async disable(name: string): Promise<void> {
		const server = await this.get(name);
		if (server) {
			await this.configStore.save({ ...server, enabled: false });
		}
	}

	async remove(name: string): Promise<void> {
		await this.configStore.delete(name);
	}

	async healthCheck(name: string): Promise<HealthStatus> {
		const server = await this.get(name);
		if (!server) {
			return {
				status: "down",
				latency: -1,
				lastCheck: Date.now(),
				reason: "not found",
			};
		}

		if (!server.enabled) {
			return {
				status: "down",
				latency: -1,
				lastCheck: Date.now(),
				reason: "disabled",
			};
		}

		const manager = new ServerManager();
		const startAt = Date.now();
		try {
			const client = await manager.start(server);
			const success = await client.ping();
			const latency = Date.now() - startAt;
			return {
				status: success ? (latency < 1000 ? "healthy" : "degraded") : "down",
				latency,
				lastCheck: Date.now(),
			};
		} catch (error) {
			return {
				status: "down",
				latency: -1,
				lastCheck: Date.now(),
				lastError: (error as Error).message,
			};
		} finally {
			await manager.stop(name);
		}
	}

	async aliasCreate(
		name: string,
		command: string,
		args: string[] = [],
		options?: { env?: Record<string, string>; description?: string },
	): Promise<void> {
		const alias: McpAlias = {
			name,
			command,
			args,
			env: options?.env,
			description: options?.description,
		};
		await this.aliasStore.save(alias);
	}

	async aliasGet(name: string): Promise<McpAlias | undefined> {
		return await this.aliasStore.get(name);
	}

	async aliasList(): Promise<McpAlias[]> {
		return await this.aliasStore.list();
	}

	async aliasDelete(name: string): Promise<void> {
		await this.aliasStore.delete(name);
	}
}
