import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { ConfigStore } from "./ConfigStore";
import type { McpServer } from "./types";

let db: Database;
let store: ConfigStore;

beforeEach(() => {
	db = new Database(":memory:");
	store = new ConfigStore(db);
});

test("ConfigStore can save and load MCP config", async () => {
	const server: McpServer = {
		id: "fs-1",
		name: "filesystem",
		package: "@modelcontextprotocol/server-filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	};

	await store.save(server);
	const loaded = await store.get("filesystem");

	expect(loaded?.name).toBe("filesystem");
	expect(loaded?.enabled).toBe(true);
	expect(loaded?.package).toBe("@modelcontextprotocol/server-filesystem");
});

test("ConfigStore can update existing MCP config", async () => {
	const server: McpServer = {
		id: "fs-1",
		name: "filesystem",
		package: "@test/server",
		command: "node",
		args: ["server.js"],
		enabled: true,
	};

	await store.save(server);

	// Update
	const updated = { ...server, enabled: false };
	await store.save(updated);

	const loaded = await store.get("filesystem");
	expect(loaded?.enabled).toBe(false);
});

test("ConfigStore can list all servers", async () => {
	const server1: McpServer = {
		id: "fs-1",
		name: "filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	};

	const server2: McpServer = {
		id: "gh-1",
		name: "github",
		command: "node",
		args: ["github-server.js"],
		enabled: false,
	};

	await store.save(server1);
	await store.save(server2);

	const all = await store.listAll();
	expect(all.length).toBe(2);
	expect(all.some((s) => s.name === "filesystem")).toBe(true);
	expect(all.some((s) => s.name === "github")).toBe(true);
});

test("ConfigStore can delete a server", async () => {
	const server: McpServer = {
		id: "fs-1",
		name: "filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	};

	await store.save(server);
	await store.delete("filesystem");

	const loaded = await store.get("filesystem");
	expect(loaded).toBeUndefined();
});

test("ConfigStore returns undefined for non-existent server", async () => {
	const loaded = await store.get("non-existent");
	expect(loaded).toBeUndefined();
});
