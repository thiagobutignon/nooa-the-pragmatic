import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { Client } from "./Client";

class StubClient extends Client {
	private attempts = 0;

	constructor(private failures: number) {
		super({
			command: "echo",
			args: [],
		});
	}

	protected async sendRequest(
		method: string,
		params: unknown,
		timeoutMs = 30000,
	): Promise<unknown> {
		this.attempts += 1;
		if (this.attempts <= this.failures) {
			throw new Error("transient");
		}
		return {
			method,
			params,
			attempts: this.attempts,
			timeout: timeoutMs,
			resources: method === "resources/list" ? ["r1"] : undefined,
			tools: method === "tools/list" ? ["t1"] : undefined,
		};
	}
}

test("callTool retries until transient failures resolve", async () => {
	const client = new StubClient(2);
	const result = (await client.callTool(
		"echo",
		{ message: "hi" },
		{ retries: 3, backoff: 1 },
	)) as unknown;
	expect(result.attempts).toBe(3);
	expect(result.params.name).toBe("echo");
	expect(result.params.arguments).toEqual({ message: "hi" });
});

test("callTool throws after max retries", async () => {
	const client = new StubClient(5);
	await expect(
		client.callTool("echo", { data: "ping" }, { retries: 3, backoff: 1 }),
	).rejects.toThrow("transient");
});

test("Client methods delegate to sendRequest", async () => {
	const client = new StubClient(0);
	const resources = await client.listResources();
	expect(resources).toEqual(["r1"]);

	const read = await client.readResource("uri");
	expect((read as unknown).params).toEqual({ uri: "uri" });

	const tools = await client.listTools();
	expect(tools).toEqual(["t1"]);

	const ping = await client.ping();
	expect(ping).toBe(true);
});

test("Real Client flow with mock process", async () => {
	const client = new Client({ command: "dummy", args: [] });

	const mockStdin = { write: () => true };
	const mockStdout = new PassThrough();
	const mockProcess = Object.assign(new EventEmitter(), {
		stdin: mockStdin,
		stdout: mockStdout,
		kill: () => {},
		killed: false,
	});

	const writes: string[] = [];
	mockStdin.write = (chunk: string) => {
		writes.push(chunk);
		return true;
	};

	const readline = createInterface({ input: mockStdout });
	(client as unknown).process = mockProcess;
	(client as unknown).readline = readline;
	readline.on("line", (line) => {
		const response = JSON.parse(line) as { id: number; result?: unknown };
		const pendingRequests = (client as unknown).pendingRequests as Map<
			number,
			{
				resolve: (value: unknown) => void;
				reject: (error: Error) => void;
				timer: ReturnType<typeof setTimeout>;
			}
		>;
		const pending = pendingRequests.get(response.id);
		if (pending) {
			clearTimeout(pending.timer);
			pendingRequests.delete(response.id);
			pending.resolve(response.result);
		}
	});

	const pending = (client as unknown).sendRequest("test", {}) as Promise<unknown>;
	mockStdout.write(
		`${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } })}\n`,
	);
	await expect(pending).resolves.toEqual({ ok: true });
	expect(writes.length).toBe(1);
});

test("stop rejects pending requests and clears their timers", async () => {
	const client = new Client({ command: "dummy", args: [] });

	const mockStdin = { write: () => true };
	const mockStdout = new EventEmitter();
	const mockProcess = Object.assign(new EventEmitter(), {
		stdin: mockStdin,
		stdout: mockStdout,
		kill: () => {},
		killed: false,
	});

	(client as unknown).process = mockProcess;

	const pending = (client as unknown).sendRequest("test", {}, 1000) as Promise<unknown>;
	await client.stop();

	await expect(pending).rejects.toThrow("Client stopped");
});
