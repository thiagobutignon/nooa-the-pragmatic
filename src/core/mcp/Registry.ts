import type { Database } from "bun:sqlite";
import { ConfigStore } from "./ConfigStore";
import type { McpServer } from "./types";

export class Registry {
	private configStore: ConfigStore;

	constructor(db: Database) {
		this.configStore = new ConfigStore(db);
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
}
