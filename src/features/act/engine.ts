import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { EventBus } from "../../core/event-bus"; // Assume global or passed?
import { createTraceId } from "../../core/logger";
import { loadCommands } from "../../core/registry";
import type { SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { WorkflowEngine } from "../../core/workflow/Engine";
import { TestGate } from "../../core/workflow/gates";
import { AiEngine } from "../ai/engine";
import {
	GroqProvider,
	MockProvider,
	OllamaProvider,
	OpenAiProvider,
} from "../ai/providers/mod";
// If options has bus, use it. ActOptions didn't have bus type explicitly? It should.
// "onEvent" is old pattern. New pattern uses bus.

export type ActEvent =
	| { type: "thought"; content: string }
	| { type: "command"; content: string }
	| { type: "output"; content: string }
	| { type: "error"; content: string };

interface ActOptions {
	maxTurns?: number;
	model?: string;
	provider?: string;
	onEvent?: (event: ActEvent) => void;
	bus?: any; // EventBus; using any to match untyped usages if needed, or import EventBus
	skipVerification?: boolean;
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
		this.ai.register(new GroqProvider());
		this.ai.register(new MockProvider());
	}

	private async loadContext(root: string): Promise<string> {
		const nooaDir = join(root, ".nooa");
		const files = ["SOUL.md", "USER.md", "TOOLS.md"];
		let context = "";

		for (const file of files) {
			const path = join(nooaDir, file);
			if (existsSync(path)) {
				try {
					const content = await readFile(path, "utf-8");
					context += `\n\n=== ${file} ===\n${content}`;
				} catch {
					// Ignore read errors
				}
			}
		}
		return context;
	}

	private async saveAuditLog(
		root: string,
		goal: string,
		history: any[],
		result: any,
	) {
		try {
			const logsDir = join(root, ".nooa", "logs");
			await mkdir(logsDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const filename = join(logsDir, `act-${timestamp}.json`);

			const logEntry = {
				timestamp: new Date().toISOString(),
				goal,
				result,
				conversation: history,
			};

			await writeFile(filename, JSON.stringify(logEntry, null, 2));
		} catch (_error) {
			// Silently fail logging to not disrupt execution
		}
	}

	async execute(
		goal: string,
		options: ActOptions = {},
	): Promise<SdkResult<ActResult>> {
		const root = process.cwd();
		const featuresDir = join(root, "src/features");
		const registry = await loadCommands(featuresDir);
		const commands = registry.list();
		const context = await this.loadContext(root);

		const tools = commands
			.filter((cmd) => cmd.agentDoc)
			.map((cmd) => ({
				name: cmd.name,
				description: cmd.description,
				agentDoc: cmd.agentDoc
					?.replace(/<examples>[\s\S]*?<\/examples>/g, "")
					.replace(/<contract>[\s\S]*?<\/contract>/g, "")
					.replace(/<exit-codes>[\s\S]*?<\/exit-codes>/g, "")
					.replace(/<errors>[\s\S]*?<\/errors>/g, "")
					.replace(/\s+/g, " ")
					.trim(),
			}));

		const systemPrompt = `
You are the NOOA Orchestrator. Your goal is to achieve the user's objective by executing CLI commands.

### CONTEXT & IDENTITY
${context || "No context found. Operate in default mode."}

### TOOLS (CLI Commands)
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

### VALID REFS (XML)
${tools.map((t) => t.agentDoc).join("\n\n")}

INSTRUCTIONS:
1. Analyze the user's goal considering the CONTEXT (SOUL/USER/TOOLS).
2. Decide which command to run.
3. OUTPUT a JSON object with the plan:
   {
     "thought": "Thinking process...",
     "command": "nooa <subcommand> [flags] [args]",
     "answer": "Final message to the user (required if done)",
     "done": boolean
   }

RULES:
- Adhere to the working style in USER.md/TOOLS.md.
- Use exact CLI syntax from XML.
- If done, set done: true and provide an "answer".
- UNLESS you are running a command. IF "command" is set, "done" MUST be false. You must wait for the command result.
- Output RAW JSON only.
`;

		const history: Array<{
			role: "user" | "assistant" | "system";
			content: string;
		}> = [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: `GOAL: ${goal}` },
		];

		const traceId = createTraceId();
		const bus = options.bus as EventBus | undefined;

		bus?.emit("act.started", {
			type: "act.started",
			traceId,
			goal,
		});

		let turn = 0;
		const maxTurns = options.maxTurns ?? 10;

		// Helper to finalize and log
		const finalize = async (result: SdkResult<ActResult>) => {
			await this.saveAuditLog(root, goal, history, result);

			bus?.emit("act.completed", {
				type: "act.completed",
				traceId,
				result: result.ok ? "success" : "failure",
			});

			return result;
		};

		// Workflow / Gates Engine
		const workflow = new WorkflowEngine();

		// Verification Function
		const verifyWork = async (): Promise<{ ok: boolean; reason?: string }> => {
			// For MVP, we simply run TestGate.
			// SpecGate might be too strict if spec is implicit?
			// Let's enforce TestGate at minimum for "programming agent".
			const steps = [
				{ id: "test", gate: new TestGate(), action: async () => {} },
			];

			const ctx = {
				traceId,
				command: "act",
				args: { goal },
				cwd: root,
			};

			const res = await workflow.run(steps, ctx);
			if (!res.ok) {
				return {
					ok: false,
					reason: `Verification Failed (${res.failedStepId}): ${res.reason}`,
				};
			}
			return { ok: true };
		};

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

			let plan:
				| {
						thought?: string;
						command?: string | null;
						done?: boolean;
						answer?: string;
				  }
				| undefined;
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

			// Emit thinking event to UI
			if (plan?.thought) {
				options.onEvent?.({ type: "thought", content: plan.thought });
			}

			// Push the FULL plan to history to maintain context integrity
			history.push({ role: "assistant", content: JSON.stringify(plan) });

			// 1. Handle Command (Priority: High)
			// If a command exists, we MUST execute it, regardless of 'done'.
			// The model often tries to 'done: true' while running a command, which is wrong.
			if (plan?.command) {
				options.onEvent?.({ type: "command", content: plan.command });

				try {
					if (!plan.command.startsWith("nooa ")) {
						throw new Error("Security: Only 'nooa' commands are allowed.");
					}

					const { stdout, stderr, exitCode } = await execa(plan.command, {
						shell: true,
						reject: false,
					});

					const output = `Exit: ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
					options.onEvent?.({ type: "output", content: output });
					history.push({ role: "user", content: `Command Result:\n${output}` });
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					options.onEvent?.({ type: "error", content: msg });
					history.push({ role: "user", content: `Execution Error: ${msg}` });
				}

				// Force next turn to analyze result
				continue;
			}

			// 2. Handle Completion
			if (plan?.done) {
				// BEFORE attempting to finish, we VERIFY.
				if (!options.skipVerification) {
					const verification = await verifyWork();
					if (!verification.ok) {
						const errorMsg = `CANNOT FINISH: ${verification.reason}`;
						options.onEvent?.({ type: "error", content: errorMsg });
						// Push error to history so agent sees it
						history.push({ role: "user", content: errorMsg });
						// Force agent to continue and fix
						continue;
					}
				}

				const finalAnswer = plan.answer ?? plan.thought ?? "Goal achieved.";
				return finalize({
					ok: true,
					data: {
						ok: true,
						history,
						finalAnswer,
					},
				});
			}

			// 3. Handle Pure Thought (No command, not done)
			// Just continue to next turn (model might be doing CoT)
			// But we need to make sure we don't loop forever if it does nothing.
			if (!plan?.command && !plan?.done) {
			}
		}

		return finalize({
			ok: false,
			error: sdkError(
				"act.max_turns_exceeded",
				`Goal not achieved after ${maxTurns} turns.`,
			),
		});
	}
}
