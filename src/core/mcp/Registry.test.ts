import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { Registry } from "./Registry";

let db: Database;
let registry: Registry;

beforeEach(() => {
	db = new Database(":memory:");
	registry = new Registry(db);
});

test("Registry can add and retrieve MCP", async () => {
	await registry.add({
		id: "fs-1",
		name: "filesystem",
		package: "@modelcontextprotocol/server-filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	});

	const mcp = await registry.get("filesystem");
	expect(mcp?.name).toBe("filesystem");
});

test("Registry can enable/disable MCP", async () => {
	await registry.add({
		id: "gh-1",
		name: "github",
		command: "node",
		args: ["server.js"],
		enabled: true,
	});

	await registry.disable("github");
	let mcp = await registry.get("github");
	expect(mcp?.enabled).toBe(false);

	await registry.enable("github");
	mcp = await registry.get("github");
	expect(mcp?.enabled).toBe(true);
});

test("Registry can list all MCPs", async () => {
	await registry.add({
		id: "fs-1",
		name: "filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	});

	await registry.add({
		id: "gh-1",
		name: "github",
		command: "node",
		args: ["server.js"],
		enabled: false,
	});

	const all = await registry.listAll();
	expect(all.length).toBe(2);
});

test("Registry can list only enabled MCPs", async () => {
	await registry.add({
		id: "fs-1",
		name: "filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	});

	await registry.add({
		id: "gh-1",
		name: "github",
		command: "node",
		args: ["server.js"],
		enabled: false,
	});

	const enabled = await registry.listEnabled();
	expect(enabled.length).toBe(1);
	expect(enabled[0].name).toBe("filesystem");
});

test("Registry can remove MCP", async () => {
	await registry.add({
		id: "fs-1",
		name: "filesystem",
		command: "node",
		args: ["server.js"],
		enabled: true,
	});

	await registry.remove("filesystem");
	const mcp = await registry.get("filesystem");
	expect(mcp).toBeUndefined();
});
