import { expect, test } from "bun:test";
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
		};
	}
}

test("callTool retries until transient failures resolve", async () => {
	const client = new StubClient(2);
	const result = await client.callTool(
		"echo",
		{ message: "hi" },
		{ retries: 3, backoff: 1 },
	);
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
