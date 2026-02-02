import { Client } from "./Client";
import type { ConfigStore } from "./ConfigStore";
import type { McpServer } from "./types";

export class ServerManager {
	private clients = new Map<string, Client>();

	constructor(_configStore: ConfigStore) {}

	async start(config: McpServer): Promise<Client> {
		// Stop existing client if already running
		if (this.clients.has(config.name)) {
			await this.stop(config.name);
		}

		const client = new Client({
			command: config.command,
			args: config.args,
			env: config.env,
		});

		await client.start();
		this.clients.set(config.name, client);

		return client;
	}

	async stop(name: string): Promise<void> {
		const client = this.clients.get(name);
		if (client) {
			await client.stop();
			this.clients.delete(name);
		}
	}

	async stopAll(): Promise<void> {
		const stopPromises = Array.from(this.clients.keys()).map((name) =>
			this.stop(name),
		);
		await Promise.all(stopPromises);
	}

	isRunning(name: string): boolean {
		const client = this.clients.get(name);
		return client ? client.isRunning() : false;
	}

	getClient(name: string): Client | undefined {
		return this.clients.get(name);
	}

	getRunningServers(): string[] {
		return Array.from(this.clients.keys()).filter((name) =>
			this.isRunning(name),
		);
	}
}
