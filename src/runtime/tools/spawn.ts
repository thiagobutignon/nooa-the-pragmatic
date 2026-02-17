import type { ToolDefinition } from "../tool-registry";
import { asyncResult, errorResult, type ToolResult } from "../types";

export type SpawnExecutor = (
	task: string,
	label?: string,
) => Promise<ToolResult>;

export function createSpawnTool(executor: SpawnExecutor): ToolDefinition {
	return {
		name: "spawn",
		description: "Spawn an async subagent task",
		parameters: {
			task: { type: "string", required: true },
			label: { type: "string", required: false },
		},
		execute: async (args) => {
			const task = typeof args.task === "string" ? args.task.trim() : "";
			const label =
				typeof args.label === "string" ? args.label.trim() : undefined;

			if (task.length === 0) {
				return errorResult("spawn requires a non-empty task");
			}
			if (/\bspawn\b/i.test(task)) {
				return errorResult("spawn cannot call spawn recursively");
			}

			void executor(task, label).catch(() => {
				// Fire-and-forget execution; failure is surfaced in subagent logs.
			});

			const suffix = label ? ` (${label})` : "";
			return asyncResult(`spawn scheduled${suffix}: ${task}`);
		},
	};
}
