import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { ConfigStore } from "./ConfigStore";
import { ServerManager } from "./ServerManager";
import type { McpServer } from "./types";

let db: Database;
let configStore: ConfigStore;
let manager: ServerManager;

beforeEach(() => {
	db = new Database(":memory:");
	configStore = new ConfigStore(db);
	manager = new ServerManager(configStore);
});

test("ServerManager can start a server", async () => {
	const config: McpServer = {
		id: "test-1",
		name: "test-server",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	const client = await manager.start(config);
	expect(client).toBeDefined();
	expect(client.isRunning()).toBe(true);

	await manager.stopAll();
});

test("ServerManager tracks running servers", async () => {
	const config: McpServer = {
		id: "test-1",
		name: "test-server",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	await manager.start(config);
	expect(manager.isRunning("test-server")).toBe(true);

	await manager.stopAll();
});

test("ServerManager can stop a specific server", async () => {
	const config: McpServer = {
		id: "test-1",
		name: "test-server",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	await manager.start(config);
	await manager.stop("test-server");

	expect(manager.isRunning("test-server")).toBe(false);
});

test("ServerManager can get running client", async () => {
	const config: McpServer = {
		id: "test-1",
		name: "test-server",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	await manager.start(config);
	const client = manager.getClient("test-server");

	expect(client).toBeDefined();
	expect(client?.isRunning()).toBe(true);

	await manager.stopAll();
});

test("ServerManager stops all servers on stopAll", async () => {
	const config1: McpServer = {
		id: "test-1",
		name: "server-1",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	const config2: McpServer = {
		id: "test-2",
		name: "server-2",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	await manager.start(config1);
	await manager.start(config2);

	expect(manager.isRunning("server-1")).toBe(true);
	expect(manager.isRunning("server-2")).toBe(true);

	await manager.stopAll();

	expect(manager.isRunning("server-1")).toBe(false);
	expect(manager.isRunning("server-2")).toBe(false);
});

test("ServerManager returns list of running servers", async () => {
	const config: McpServer = {
		id: "test-1",
		name: "test-server",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	};

	await manager.start(config);
	const running = manager.getRunningServers();
	expect(running).toHaveLength(1);
	expect(running).toContain("test-server");

	await manager.stopAll();
	const runningAfter = manager.getRunningServers();
	expect(runningAfter).toHaveLength(0);
});
