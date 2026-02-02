import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { Registry } from "./Registry";
import { ServerManager } from "./ServerManager";
import { ToolProvider } from "./ToolProvider";

let db: Database;
let registry: Registry;
let serverManager: ServerManager;
let toolProvider: ToolProvider;

beforeEach(() => {
	db = new Database(":memory:");
	registry = new Registry(db);
	serverManager = new ServerManager(registry.configStore);
	toolProvider = new ToolProvider(registry, serverManager);
});

test("ToolProvider can get tools from enabled MCPs", async () => {
	// Add and start a test MCP
	await registry.add({
		id: "test-1",
		name: "test-mcp",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	});

	const tools = await toolProvider.getAvailableTools();
	expect(Array.isArray(tools)).toBe(true);
	expect(tools.length).toBeGreaterThan(0);

	await serverManager.stopAll();
});

test("ToolProvider can execute a tool", async () => {
	await registry.add({
		id: "test-1",
		name: "test-mcp",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	});

	const result = await toolProvider.executeTool({
		mcpSource: "test-mcp",
		name: "echo",
		args: { message: "hello from tool provider" },
	});

	expect(result).toBeDefined();
	expect(result.content).toBeDefined();

	await serverManager.stopAll();
});

test("ToolProvider returns empty array for no enabled MCPs", async () => {
	const tools = await toolProvider.getAvailableTools();
	expect(tools).toEqual([]);
});
