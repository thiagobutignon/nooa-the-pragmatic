import { describe, expect, it } from "bun:test";
import { ToolRegistry } from "./tool-registry";
import { toolResult } from "./types";

describe("ToolRegistry", () => {
	it("registers and retrieves a tool", () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "read_file",
			description: "Read a file",
			parameters: { path: { type: "string", required: true } },
			execute: async () => toolResult("file content"),
		});

		const tool = registry.get("read_file");
		expect(tool).toBeDefined();
		expect(tool?.name).toBe("read_file");
	});

	it("executes a tool and returns ToolResult", async () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "echo",
			description: "Echo back input",
			parameters: { text: { type: "string", required: true } },
			execute: async (args) => toolResult(`Echo: ${args.text}`),
		});

		const result = await registry.execute("echo", { text: "hello" });
		expect(result.forLlm).toBe("Echo: hello");
		expect(result.isError).toBe(false);
	});

	it("returns error for unknown tool", async () => {
		const registry = new ToolRegistry();
		const result = await registry.execute("nonexistent", {});
		expect(result.isError).toBe(true);
		expect(result.forLlm).toContain("nonexistent");
	});

	it("lists all registered tools", () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "tool_a",
			description: "A",
			parameters: {},
			execute: async () => toolResult("a"),
		});
		registry.register({
			name: "tool_b",
			description: "B",
			parameters: {},
			execute: async () => toolResult("b"),
		});

		const defs = registry.listDefinitions();
		expect(defs).toHaveLength(2);
		expect(defs.map((d) => d.name)).toContain("tool_a");
		expect(defs.map((d) => d.name)).toContain("tool_b");
	});

	it("generates tool definitions for LLM prompt", () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "search",
			description: "Search files",
			parameters: { query: { type: "string", required: true } },
			execute: async () => toolResult("results"),
		});

		const schema = registry.toToolSchema();
		expect(schema).toHaveLength(1);
		expect(schema[0].type).toBe("function");
		expect(schema[0].function.name).toBe("search");
	});
});

describe("ToolRegistry with DangerousCommandGuard", () => {
	it("blocks dangerous commands in exec-like tools", async () => {
		const registry = new ToolRegistry({ enableCommandGuard: true });
		registry.register({
			name: "exec",
			description: "Execute shell command",
			parameters: { command: { type: "string", required: true } },
			execute: async (args) => toolResult(`Executed: ${args.command}`),
			isShellTool: true,
		});

		const result = await registry.execute("exec", { command: "rm -rf /" });
		expect(result.isError).toBe(true);
		expect(result.forLlm).toContain("Blocked");
	});

	it("allows safe commands through guard", async () => {
		const registry = new ToolRegistry({ enableCommandGuard: true });
		registry.register({
			name: "exec",
			description: "Execute shell command",
			parameters: { command: { type: "string", required: true } },
			execute: async (args) => toolResult(`Executed: ${args.command}`),
			isShellTool: true,
		});

		const result = await registry.execute("exec", { command: "ls -la" });
		expect(result.isError).toBe(false);
	});

	it("blocks dangerous commands in non-command string args", async () => {
		const registry = new ToolRegistry({ enableCommandGuard: true });
		registry.register({
			name: "exec_alt",
			description: "Execute shell command using cmd arg",
			parameters: { cmd: { type: "string", required: true } },
			execute: async (args) => toolResult(`Executed: ${args.cmd}`),
			isShellTool: true,
		});

		const result = await registry.execute("exec_alt", { cmd: "rm -rf /" });
		expect(result.isError).toBe(true);
		expect(result.forLlm).toContain("Blocked");
	});
});
