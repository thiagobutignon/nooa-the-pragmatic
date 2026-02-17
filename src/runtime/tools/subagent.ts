import type { ToolDefinition } from "../tool-registry";
import { errorResult, type ToolResult } from "../types";

export type SubagentExecutor = (task: string) => Promise<ToolResult>;

function truncateForUser(text: string): string {
	if (text.length <= 500) return text;
	return `${text.slice(0, 500)}...`;
}

export function createSubagentTool(executor: SubagentExecutor): ToolDefinition {
	return {
		name: "subagent",
		description: "Delegate a synchronous task to a subagent",
		parameters: {
			task: { type: "string", required: true },
		},
		execute: async (args) => {
			const task = typeof args.task === "string" ? args.task.trim() : "";
			if (task.length === 0) {
				return errorResult("subagent requires a non-empty task");
			}

			const result = await executor(task);
			return {
				...result,
				async: false,
				forUser: truncateForUser(result.forUser ?? result.forLlm),
			};
		},
	};
}
