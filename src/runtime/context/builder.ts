import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Message } from "../session/manager";
import type { ToolRegistry } from "../tool-registry";

export interface ModelMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
}

export class ContextBuilder {
	constructor(
		private readonly workspace: string,
		private readonly registry: ToolRegistry,
	) {}

	async buildSystemPrompt(summary?: string): Promise<string> {
		const [soul, user] = await Promise.all([
			this.readOptionalFile(join(this.workspace, ".nooa", "SOUL.md")),
			this.readOptionalFile(join(this.workspace, ".nooa", "USER.md")),
		]);

		const sections: string[] = ["You are NOOA, a pragmatic coding agent."];

		if (soul) {
			sections.push("## SOUL", soul.trim());
		}
		if (user) {
			sections.push("## USER", user.trim());
		}
		if (summary) {
			sections.push("## SESSION SUMMARY", summary.trim());
		}

		const toolSchemas = this.registry.toToolSchema();
		if (toolSchemas.length > 0) {
			const toolsText = toolSchemas
				.map((tool) => {
					const required = tool.function.parameters.required;
					const props = Object.entries(tool.function.parameters.properties)
						.map(([name, param]) => {
							const req = required.includes(name) ? "required" : "optional";
							return `- ${name}: ${param.type} (${req})${param.description ? ` - ${param.description}` : ""}`;
						})
						.join("\n");
					return `### ${tool.function.name}\n${tool.function.description}\n${props}`;
				})
				.join("\n\n");
			sections.push("## TOOLS", toolsText);
		}

		return sections.join("\n\n");
	}

	async buildMessages(
		history: Message[],
		input: string,
		summary?: string,
	): Promise<ModelMessage[]> {
		const systemPrompt = await this.buildSystemPrompt(summary);
		const messages: ModelMessage[] = [
			{ role: "system", content: systemPrompt },
		];

		for (const message of history) {
			messages.push({ role: message.role, content: message.content });
		}

		const trimmedInput = input.trim();
		if (trimmedInput.length > 0) {
			messages.push({ role: "user", content: trimmedInput });
		}
		return messages;
	}

	private async readOptionalFile(path: string): Promise<string | undefined> {
		try {
			return await readFile(path, "utf8");
		} catch {
			return undefined;
		}
	}
}
