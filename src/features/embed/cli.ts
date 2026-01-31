import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { embedText } from "./engine";

const embedHelp = `
Usage: nooa embed <text|file> <input> [flags]

Arguments:
  text <string>     Embed a raw string
  file <path>       Embed file contents

Flags:
  --model <name>            Model name (default: nomic-embed-text)
  --provider <name>         Provider (default: ollama)
  --include-embedding       Include vector in output
  --out <file>              Write JSON output to file
  --json                    Output JSON (default)
  -h, --help                Show help
`;

const embedCommand: Command = {
	name: "embed",
	description: "Generate embeddings for text or files",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { readFile, writeFile } = await import("node:fs/promises");
		const { randomUUID } = await import("node:crypto");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				model: { type: "string" },
				provider: { type: "string" },
				"include-embedding": { type: "boolean" },
				out: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean", short: "h" },
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		if (values.help) {
			console.log(embedHelp);
			return;
		}

		const traceId = createTraceId();
		logger.setContext({ trace_id: traceId, command: "embed" });
		const startTime = Date.now();

		try {
			const action = positionals[1];
			const inputArg = positionals.slice(2).join(" ").trim();
			if (!action || !inputArg) {
				telemetry.track(
					{
						event: "embed.failure",
						level: "warn",
						success: false,
						trace_id: traceId,
						metadata: {
							reason: "missing_input",
							duration_ms: Date.now() - startTime,
						},
					},
					bus,
				);
				console.error("Error: Input is required.");
				process.exitCode = 2;
				return;
			}

			let inputText = "";
			let inputType: "text" | "file" = "text";
			let inputPath: string | null = null;

			if (action === "text") {
				inputType = "text";
				inputText = inputArg;
			} else if (action === "file") {
				inputType = "file";
				inputPath = positionals[2];
				if (!inputPath) {
					telemetry.track(
						{
							event: "embed.failure",
							level: "warn",
							success: false,
							trace_id: traceId,
							metadata: {
								reason: "missing_path",
								duration_ms: Date.now() - startTime,
							},
						},
						bus,
					);
					console.error("Error: File path is required.");
					process.exitCode = 2;
					return;
				}
				inputText = await readFile(inputPath, "utf-8");
			} else {
				telemetry.track(
					{
						event: "embed.failure",
						level: "warn",
						success: false,
						trace_id: traceId,
						metadata: {
							reason: "unknown_action",
							duration_ms: Date.now() - startTime,
						},
					},
					bus,
				);
				console.error("Error: Unknown embed action.");
				process.exitCode = 2;
				return;
			}

			telemetry.track(
				{
					event: "embed.started",
					level: "info",
					success: true,
					trace_id: traceId,
					metadata: {
						input_type: inputType,
						bytes: Buffer.byteLength(inputText, "utf-8"),
					},
				},
				bus,
			);

			const result = await embedText(inputText, {
				provider: values.provider as string | undefined,
				model: values.model as string | undefined,
			});

			const payload: Record<string, unknown> = {
				id: randomUUID(),
				model: result.model,
				provider: result.provider,
				dimensions: result.dimensions,
				input: {
					type: inputType,
					path: inputPath,
					value: inputType === "text" ? inputText : null,
				},
			};

			if (values["include-embedding"]) {
				payload.embedding = result.embedding;
			}

			telemetry.track(
				{
					event: "embed.success",
					level: "info",
					success: true,
					trace_id: traceId,
					metadata: {
						input_type: inputType,
						bytes: Buffer.byteLength(inputText, "utf-8"),
						model: result.model,
						provider: result.provider,
						duration_ms: Date.now() - startTime,
					},
				},
				bus,
			);

			const output = JSON.stringify(payload, null, 2);
			if (values.out) {
				await writeFile(String(values.out), output);
				return;
			}

			console.log(output);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			telemetry.track(
				{
					event: "embed.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: {
						error_message: message,
						duration_ms: Date.now() - startTime,
					},
				},
				bus,
			);
			console.error(`Error: ${message}`);
			process.exitCode = 1;
		}
	},
};

export default embedCommand;
