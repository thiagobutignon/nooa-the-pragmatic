import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

interface ClientConfig {
	command: string;
	args: string[];
	env?: Record<string, string>;
}

interface JsonRpcRequest {
	jsonrpc: string;
	id: number;
	method: string;
	// biome-ignore lint/suspicious/noExplicitAny: JSON-RPC params are dynamic
	params?: any;
}

interface JsonRpcResponse {
	jsonrpc: string;
	id: number;
	// biome-ignore lint/suspicious/noExplicitAny: JSON-RPC result is dynamic
	result?: any;
	error?: {
		code: number;
		message: string;
	};
}

export class Client {
	private process?: ChildProcess;
	private requestId = 0;
	private pendingRequests = new Map<
		number,
		{
			resolve: (value: any) => void;
			reject: (error: Error) => void;
		}
	>();
	private readline?: ReturnType<typeof createInterface>;

	constructor(private config: ClientConfig) {}

	async start(): Promise<void> {
		if (this.process) {
			throw new Error("Client already started");
		}

		this.process = spawn(this.config.command, this.config.args, {
			stdio: ["pipe", "pipe", "inherit"],
			env: { ...process.env, ...this.config.env },
		});

		if (!this.process.stdout) {
			throw new Error("Failed to create stdout pipe");
		}

		// Setup readline for JSON-RPC responses
		this.readline = createInterface({
			input: this.process.stdout,
		});

		this.readline.on("line", (line) => {
			try {
				const response: JsonRpcResponse = JSON.parse(line);
				const pending = this.pendingRequests.get(response.id);

				if (pending) {
					this.pendingRequests.delete(response.id);
					if (response.error) {
						pending.reject(new Error(`RPC Error: ${response.error.message}`));
					} else {
						pending.resolve(response.result);
					}
				}
			} catch (_error) {
				// Ignore parse errors
			}
		});

		// Initialize the MCP server
		await this.sendRequest("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: {
				name: "nooa-mcp-client",
				version: "1.0.0",
			},
		});
	}

	async stop(): Promise<void> {
		if (!this.process) return;

		this.readline?.close();
		this.process.kill();
		this.process = undefined;
		this.readline = undefined;
		this.pendingRequests.clear();
	}

	isRunning(): boolean {
		return !!this.process && !this.process.killed;
	}

	async listTools(): Promise<any[]> {
		const result = await this.sendRequest("tools/list", {});
		return result.tools || [];
	}

	async callTool(name: string, args: any): Promise<any> {
		return await this.sendRequest("tools/call", {
			name,
			arguments: args,
		});
	}

	async listResources(): Promise<any[]> {
		const result = await this.sendRequest("resources/list", {});
		return result.resources || [];
	}

	async readResource(uri: string): Promise<any> {
		return await this.sendRequest("resources/read", { uri });
	}

	async ping(): Promise<boolean> {
		try {
			await this.sendRequest("ping", {});
			return true;
		} catch {
			return false;
		}
	}

	private async sendRequest(method: string, params: any): Promise<any> {
		if (!this.process?.stdin) {
			throw new Error("Client not started");
		}

		const id = ++this.requestId;
		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		};

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });

			const requestLine = JSON.stringify(request);
			this.process?.stdin?.write(`${requestLine}\n`);

			// Timeout after 30 seconds
			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error(`Request timeout: ${method}`));
				}
			}, 30000);
		});
	}
}
