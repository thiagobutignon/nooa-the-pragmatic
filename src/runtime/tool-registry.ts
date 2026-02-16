import { DangerousCommandGuard } from "./security/command-guard";
import { errorResult, type ToolResult } from "./types";

export interface ToolParam {
	type: "string" | "number" | "boolean";
	required?: boolean;
	description?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, ToolParam>;
	execute: (args: Record<string, unknown>) => Promise<ToolResult>;
	isShellTool?: boolean;
}

export interface ToolSchema {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, { type: string; description?: string }>;
			required: string[];
		};
	};
}

export interface ToolRegistryOptions {
	enableCommandGuard?: boolean;
}

export class ToolRegistry {
	private tools = new Map<string, ToolDefinition>();
	private guard?: DangerousCommandGuard;

	constructor(options: ToolRegistryOptions = {}) {
		this.guard = options.enableCommandGuard
			? new DangerousCommandGuard()
			: undefined;
	}

	register(tool: ToolDefinition): void {
		this.tools.set(tool.name, tool);
	}

	get(name: string): ToolDefinition | undefined {
		return this.tools.get(name);
	}

	async execute(
		name: string,
		args: Record<string, unknown>,
	): Promise<ToolResult> {
		const tool = this.tools.get(name);
		if (!tool) {
			return errorResult(`Tool not found: ${name}`);
		}

		if (this.guard && tool.isShellTool) {
			for (const [argName, value] of Object.entries(args)) {
				if (typeof value !== "string") {
					continue;
				}

				const guardResult = this.guard.check(value);
				if (guardResult.blocked) {
					return errorResult(
						guardResult.reason ?? `Blocked dangerous command in "${argName}"`,
					);
				}
			}
		}

		try {
			return await tool.execute(args);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			return errorResult(`Tool "${name}" failed: ${error.message}`, error);
		}
	}

	listDefinitions(): ToolDefinition[] {
		return [...this.tools.values()];
	}

	toToolSchema(): ToolSchema[] {
		return this.listDefinitions().map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: {
					type: "object" as const,
					properties: Object.fromEntries(
						Object.entries(tool.parameters).map(([key, param]) => [
							key,
							{ type: param.type, description: param.description },
						]),
					),
					required: Object.entries(tool.parameters)
						.filter(([, p]) => p.required)
						.map(([k]) => k),
				},
			},
		}));
	}
}
