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
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: string;
	id: number;
	result?: unknown;
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
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timer: ReturnType<typeof setTimeout>;
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
					clearTimeout(pending.timer);
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

	async listTools(): Promise<unknown[]> {
		const result = (await this.sendRequest("tools/list", {})) as {
			tools?: unknown[];
		};
		return result.tools || [];
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
		options: CallOptions = {},
	): Promise<unknown> {
		const retries = Math.max(1, options.retries ?? 3);
		const timeout = options.timeout ?? 30000;
		const backoff = options.backoff ?? 500;

		for (let attempt = 1; attempt <= retries; attempt += 1) {
			try {
				return await this.sendRequest(
					"tools/call",
					{ name, arguments: args },
					timeout,
				);
			} catch (error) {
				if (attempt === retries) {
					throw error;
				}

				const delay = Math.min(backoff * 2 ** (attempt - 1), 10000);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	async listResources(): Promise<unknown[]> {
		const result = (await this.sendRequest("resources/list", {})) as {
			resources?: unknown[];
		};
		return result.resources || [];
	}

	async readResource(uri: string): Promise<unknown> {
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

	protected async sendRequest(
		method: string,
		params: unknown,
		timeoutMs = 30000,
	): Promise<unknown> {
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
			const timer = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error(`Request timeout: ${method}`));
				}
			}, timeoutMs);

			this.pendingRequests.set(id, { resolve, reject, timer });

			const requestLine = JSON.stringify(request);
			this.process?.stdin?.write(`${requestLine}\n`);
		});
	}
}

export interface CallOptions {
	retries?: number;
	timeout?: number;
	backoff?: number;
}
