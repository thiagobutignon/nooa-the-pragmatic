import { describe, expect, spyOn, test, beforeEach, afterEach } from "bun:test";
import { AiEngine } from "./engine";
import { run, streamAi } from "./cli";
import * as mcpDb from "../../core/mcp/db";
import * as mcpAi from "../../core/mcp/integrations/ai";

describe("AI CLI", () => {
	let completeSpy: any;
	let streamSpy: any;

	beforeEach(() => {
		completeSpy = spyOn(AiEngine.prototype, "complete").mockResolvedValue({
			content: "Mock response",
			provider: "mock",
			model: "mock-model",
			usage: { total_tokens: 10 }
		});
		streamSpy = spyOn(AiEngine.prototype, "stream").mockImplementation(async function* () {
			yield { content: "Mock", provider: "mock", model: "mock-model" };
			yield { content: " stream", provider: "mock", model: "mock-model" };
		});
	});

	afterEach(() => {
		completeSpy.mockRestore();
		streamSpy.mockRestore();
	});

	test("run returns error if prompt is missing", async () => {
		const result = await run({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("ai.missing_prompt");
		}
	});

	test("run executes simple prompt via engine", async () => {
		const result = await run({ prompt: "Hello" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.content).toBe("Mock response");
			expect(result.data.provider).toBe("mock");
			expect(completeSpy).toHaveBeenCalled();
		}
	});

	test("run respects provider and model flags", async () => {
		await run({ prompt: "Hello", provider: "openai", model: "gpt-4" });
		expect(completeSpy).toHaveBeenCalledWith(
			expect.objectContaining({ model: "gpt-4" }),
			expect.objectContaining({ provider: "openai" })
		);
	});

	test("run handles streaming (CLI mode)", async () => {
		const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
		const result = await run({ prompt: "Hello", stream: true });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.content).toBe("Mock stream");
		}
		expect(streamSpy).toHaveBeenCalled();
		expect(stdoutSpy).toHaveBeenCalled();
		stdoutSpy.mockRestore();
	});

	test("run executes MCP tool if flags provided", async () => {
		const mockDb = { close: () => { } } as any;
		const openDbSpy = spyOn(mcpDb, "openMcpDatabase").mockReturnValue(mockDb);
		const execMcpSpy = spyOn(mcpAi, "executeMcpToolFromAi").mockResolvedValue("Tool Result");

		const result = await run({
			prompt: "ignored",
			"mcp-source": "server",
			"mcp-tool": "tool",
			"mcp-args": '{"arg":"val"}'
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("mcp");
			expect(result.data.result).toBe("Tool Result");
		}
		expect(openDbSpy).toHaveBeenCalled();
		expect(execMcpSpy).toHaveBeenCalledWith(mockDb, "server", "tool", { arg: "val" });

		openDbSpy.mockRestore();
		execMcpSpy.mockRestore();
	});

	test("run handles invalid MCP args JSON", async () => {
		const mockDb = { close: () => { } } as any;
		const openDbSpy = spyOn(mcpDb, "openMcpDatabase").mockReturnValue(mockDb);

		const result = await run({
			prompt: "ignored",
			"mcp-source": "server",
			"mcp-tool": "tool",
			"mcp-args": "{invalid-json}"
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("ai.mcp_invalid_args");
		}
		openDbSpy.mockRestore();
	});
});
