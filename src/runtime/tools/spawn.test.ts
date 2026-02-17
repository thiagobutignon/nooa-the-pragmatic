import { describe, expect, it, mock } from "bun:test";
import { toolResult } from "../types";
import { createSpawnTool } from "./spawn";

describe("SpawnTool", () => {
	it("spawns a subagent and returns async result", async () => {
		const mockExecutor = mock(async (task: string) =>
			toolResult(`Done: ${task}`),
		);
		const tool = createSpawnTool(mockExecutor);

		const result = await tool.execute({ task: "fetch news", label: "news" });
		expect(result.async).toBe(true);
		expect(result.forLlm).toContain("news");
	});

	it("requires task parameter", async () => {
		const mockExecutor = mock(async () => toolResult("ok"));
		const tool = createSpawnTool(mockExecutor);

		const result = await tool.execute({});
		expect(result.isError).toBe(true);
	});
});
