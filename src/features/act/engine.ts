import { execa } from "execa";
import { join } from "node:path";
import { AiEngine } from "../ai/engine";
import { MockProvider, OllamaProvider, OpenAiProvider } from "../ai/providers/mod";
import { loadCommands } from "../../core/registry";
import { sdkError } from "../../core/types";
import type { SdkResult } from "../../core/types";

interface ActOptions {
	maxTurns?: number;
	model?: string;
	provider?: string;
}

interface ActResult {
	ok: boolean;
	history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
	finalAnswer: string;
}

export class ActEngine {
	private ai: AiEngine;

	constructor() {
		this.ai = new AiEngine();
		this.ai.register(new OllamaProvider());
		this.ai.register(new OpenAiProvider());
		this.ai.register(new MockProvider());
	}

	async execute(goal: string, options: ActOptions = {}): Promise<SdkResult<ActResult>> {
		const featuresDir = join(process.cwd(), "src/features");
		const registry = await loadCommands(featuresDir);
		const commands = registry.list();

		const tools = commands
			.filter((cmd) => cmd.agentDoc)
			.map((cmd) => ({
				name: cmd.name,
				description: cmd.description,
				agentDoc: cmd.agentDoc,
			}));

		const systemPrompt = `
You are the NOOA Orchestrator. Your goal is to achieve the user's objective by executing CLI commands.

You have access to the following tools (CLI Commands):
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Valid Command References (XML Docs):
${tools.map((t) => t.agentDoc).join("\n\n")}

INSTRUCTIONS:
1. Analyze the user's goal.
2. Decide which command to run.
3. OUTPUT a JSON object with the plan:
   {
     "thought": "Analysis of what to do next",
     "command": "nooa <subcommand> [flags] [args]",
     "done": boolean // true if goal is achieved
   }

RULES:
- You MUST use the exact CLI syntax defined in the XML <usage> and <contract> tags.
- If you need to read a file, use 'nooa read'.
- If you need to check code, use 'nooa check'.
- If the goal is done, set "done": true and "command": null.
- If the previous command failed, analyze the error and try a different approach.
- Do NOT output markdown code blocks. Output RAW JSON only.
`;

		const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: `GOAL: ${goal}` },
		];

		let turn = 0;
		const maxTurns = options.maxTurns ?? 10;

		while (turn < maxTurns) {
			turn++;

			const response = await this.ai.complete(
				{
					messages: history.map((h) => ({
						role: h.role,
						content: h.content,
					})),
					model: options.model,
				},
				{
					provider: options.provider,
				},
			);

			let plan: { thought?: string; command?: string | null; done?: boolean } | undefined;
			try {
				const cleanJson = response.content
					.replace(/```json/g, "")
					.replace(/```/g, "")
					.trim();
				plan = JSON.parse(cleanJson);
			} catch {
				history.push({ role: "assistant", content: response.content });
				history.push({
					role: "user",
					content: "Invalid JSON. Please output VALID JSON only.",
				});
				continue;
			}

			if (plan?.done) {
				return {
					ok: true,
					data: {
						ok: true,
						history,
						finalAnswer: plan.thought ?? "Goal achieved.",
					},
				};
			}

			if (!plan?.command) {
				history.push({ role: "assistant", content: response.content });
				history.push({
					role: "user",
					content: "You did not provide a command. If done, set done: true.",
				});
				continue;
			}

			history.push({ role: "assistant", content: JSON.stringify(plan) });

			try {
				if (!plan.command.startsWith("nooa ")) {
					throw new Error("Security: Only 'nooa' commands are allowed.");
				}

				const { stdout, stderr, exitCode } = await execa(plan.command, {
					shell: true,
					reject: false,
				});

				const output = `Exit: ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
				history.push({ role: "user", content: `Command Result:\n${output}` });
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				history.push({ role: "user", content: `Execution Error: ${msg}` });
			}
		}

		return {
			ok: false,
			error: sdkError(
				"act.max_turns_exceeded",
				`Goal not achieved after ${maxTurns} turns.`,
			),
		};
	}
}
