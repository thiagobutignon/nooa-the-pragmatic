import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { AiEngine } from "./engine";
import { MockProvider, OllamaProvider, OpenAiProvider } from "./providers/mod";

const aiHelp = `
Usage: nooa ai <prompt> [flags]

Directly query the AI engine.

Arguments:
  <prompt>       The prompt text (required).

Flags:
  --provider <name>   Provider name (default: ollama, fallback: openai).
  --model <name>      Model name override.
  --json              Output as JSON.
  -h, --help          Show help.

Examples:
  nooa ai "Who are you?"
  nooa ai "Explain TDD" --provider openai
  nooa ai "Tell a joke" --json
`;

const aiCommand: Command = {
	name: "ai",
	description: "Query the AI engine",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const parsed = parseArgs({
			args: rawArgs,
			options: {
				provider: { type: "string" },
				model: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean", short: "h" },
			},
			strict: true,
			allowPositionals: true,
		});
		const values = parsed.values as {
			provider?: string;
			model?: string;
			json?: boolean;
			help?: boolean;
		};
		const positionals = parsed.positionals as string[];

		if (values.help) {
			console.log(aiHelp);
			return;
		}

		const prompt = positionals[1];
		if (!prompt) {
			console.error("Error: Prompt is required.");
			process.exitCode = 2;
			return;
		}

		const traceId = createTraceId();
		logger.setContext({ trace_id: traceId, command: "ai" });

		const engine = new AiEngine();
		engine.register(new OllamaProvider());
		engine.register(new OpenAiProvider());
		engine.register(new MockProvider());

		try {
			const response = await engine.complete(
				{
					messages: [{ role: "user", content: prompt }],
					model: values.model,
					traceId,
				},
				{
					provider: values.provider,
					fallbackProvider: values.provider ? undefined : "openai",
				},
			);

			telemetry.track(
				{
					event: "ai.success",
					level: "info",
					success: true,
					trace_id: traceId,
					metadata: {
						provider: response.provider,
						model: response.model,
						usage: response.usage,
					},
				},
				bus,
			);

			if (values.json) {
				console.log(JSON.stringify(response, null, 2));
			} else {
				console.log(response.content);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			telemetry.track(
				{
					event: "ai.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error: errorMessage },
				},
				bus,
			);
			logger.error(
				"AI command failed",
				error instanceof Error ? error : new Error(String(error)),
			);
			process.exitCode = 1;
		}
	},
};

export default aiCommand;
