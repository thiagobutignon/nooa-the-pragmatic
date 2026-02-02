import { beforeEach, expect, test } from "bun:test";
import { Client } from "./Client";

let client: Client;

beforeEach(async () => {
	client = new Client({
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
	});
});

test("Client can start and initialize", async () => {
	await client.start();
	expect(client.isRunning()).toBe(true);
	await client.stop();
});

test("Client can list tools", async () => {
	await client.start();
	const tools = await client.listTools();

	expect(Array.isArray(tools)).toBe(true);
	expect(tools.length).toBeGreaterThan(0);
	expect(tools.some((t) => t.name === "echo")).toBe(true);

	await client.stop();
});

test("Client can call a tool", async () => {
	await client.start();
	const result = await client.callTool("echo", { message: "hello" });

	expect(result).toBeDefined();
	expect(result.content).toBeDefined();
	expect(result.content[0].text).toBe("hello");

	await client.stop();
});

test("Client can list resources", async () => {
	await client.start();
	const resources = await client.listResources();

	expect(Array.isArray(resources)).toBe(true);

	await client.stop();
});

test("Client can read a resource", async () => {
	await client.start();
	const content = await client.readResource("test://sample");

	expect(content).toBeDefined();

	await client.stop();
});

test("Client can ping server", async () => {
	await client.start();
	const isAlive = await client.ping();

	expect(isAlive).toBe(true);

	await client.stop();
});

test("Client stops cleanly", async () => {
	await client.start();
	await client.stop();

	expect(client.isRunning()).toBe(false);
});
