import { describe, expect, it, mock } from "bun:test";
import { toolResult } from "../types";
import { createSubagentTool } from "./subagent";

describe("SubagentTool", () => {
	it("executes subagent synchronously and returns result", async () => {
		const mockExecutor = mock(async (task: string) =>
			toolResult(`Completed: ${task}`),
		);
		const tool = createSubagentTool(mockExecutor);

		const result = await tool.execute({ task: "analyze code style" });
		expect(result.async).toBe(false);
		expect(result.forLlm).toContain("Completed");
	});

	it("truncates forUser at 500 chars", async () => {
		const longResult = "A".repeat(1000);
		const mockExecutor = mock(async () => toolResult(longResult));
		const tool = createSubagentTool(mockExecutor);

		const result = await tool.execute({ task: "long task" });
		expect(result.forUser?.length).toBeLessThanOrEqual(503);
	});
});
