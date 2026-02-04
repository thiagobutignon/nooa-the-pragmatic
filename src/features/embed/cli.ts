import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJsonOrWrite,
	setExitCode
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { embedText } from "./engine";

export const embedMeta: AgentDocMeta = {
	name: "embed",
	description: "Generate embeddings for text or files",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const embedHelp = `
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

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  embed.missing_action: Action (text/file) is required
  embed.missing_text: Text is required
  embed.missing_path: File path is required
  embed.unknown_action: Unknown embed action
  embed.runtime_error: Embedding failed
`;

export const embedSdkUsage = `
SDK Usage:
  const result = await embed.run({
    action: "text",
    input: "hello",
    provider: "ollama"
  });
  if (result.ok) console.log(result.data.model);
`;

export const embedUsage = {
	cli: "nooa embed <text|file> <input> [flags]",
	sdk: "await embed.run({ action: \"text\", input: \"hello\" })",
	tui: "EmbedConsole()",
};

export const embedSchema = {
	action: { type: "string", required: true },
	input: { type: "string", required: true },
	model: { type: "string", required: false },
	provider: { type: "string", required: false },
	"include-embedding": { type: "boolean", required: false },
	out: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const embedOutputFields = [
	{ name: "id", type: "string" },
	{ name: "model", type: "string" },
	{ name: "provider", type: "string" },
	{ name: "dimensions", type: "number" },
	{ name: "input", type: "string" },
	{ name: "embedding", type: "string" },
];

export const embedErrors = [
	{ code: "embed.missing_action", message: "Action (text/file) is required." },
	{ code: "embed.missing_text", message: "Text is required." },
	{ code: "embed.missing_path", message: "File path is required." },
	{ code: "embed.unknown_action", message: "Unknown embed action." },
	{ code: "embed.read_failed", message: "Failed to read file." },
	{ code: "embed.runtime_error", message: "Embedding failed." },
];

export const embedExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const embedExamples = [
	{ input: "nooa embed text \"hello\"", output: "Embedding output" },
	{ input: "nooa embed file README.md", output: "Embedding output" },
];

export interface EmbedRunInput {
	action?: "text" | "file";
	input?: string;
	model?: string;
	provider?: string;
	includeEmbedding?: boolean;
	out?: string;
	json?: boolean;
}

export interface EmbedRunResult {
	id: string;
	model: string;
	provider: string;
	dimensions: number;
	input: {
		type: "text" | "file";
		path?: string | null;
		value?: string | null;
	};
	embedding?: number[];
}

export async function run(
	input: EmbedRunInput,
): Promise<SdkResult<EmbedRunResult>> {
	const traceId = createTraceId();
	logger.setContext({ trace_id: traceId, command: "embed" });
	const startTime = Date.now();

	if (!input.action) {
		telemetry.track(
			{
				event: "embed.failure",
				level: "warn",
				success: false,
				trace_id: traceId,
				metadata: { reason: "missing_action", duration_ms: Date.now() - startTime },
			},
			undefined,
		);
		return {
			ok: false,
			error: sdkError("embed.missing_action", "Action (text/file) is required."),
		};
	}

	let inputText = "";
	let inputType: "text" | "file" = "text";
	let inputPath: string | null = null;

	if (input.action === "text") {
		inputType = "text";
		inputText = input.input ?? "";
		if (!inputText) {
			telemetry.track(
				{
					event: "embed.failure",
					level: "warn",
					success: false,
					trace_id: traceId,
					metadata: { reason: "missing_text", duration_ms: Date.now() - startTime },
				},
				undefined,
			);
			return {
				ok: false,
				error: sdkError("embed.missing_text", "Text is required."),
			};
		}
	} else if (input.action === "file") {
		inputType = "file";
		inputPath = input.input ?? null;
		if (!inputPath) {
			telemetry.track(
				{
					event: "embed.failure",
					level: "warn",
					success: false,
					trace_id: traceId,
					metadata: { reason: "missing_path", duration_ms: Date.now() - startTime },
				},
				undefined,
			);
			return {
				ok: false,
				error: sdkError("embed.missing_path", "File path is required."),
			};
		}
		try {
			const { readFile } = await import("node:fs/promises");
			inputText = await readFile(inputPath, "utf-8");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				error: sdkError("embed.read_failed", "Failed to read file.", {
					path: inputPath,
					error: message,
				}),
			};
		}
	} else {
		telemetry.track(
			{
				event: "embed.failure",
				level: "warn",
				success: false,
				trace_id: traceId,
				metadata: { reason: "unknown_action", duration_ms: Date.now() - startTime },
			},
			undefined,
		);
		return {
			ok: false,
			error: sdkError("embed.unknown_action", "Unknown embed action."),
		};
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
		undefined,
	);

	try {
		const result = await embedText(inputText, {
			provider: input.provider,
			model: input.model,
		});

		const payload: EmbedRunResult = {
			id: crypto.randomUUID(),
			model: result.model,
			provider: result.provider,
			dimensions: result.dimensions,
			input: {
				type: inputType,
				path: inputPath,
				value: inputType === "text" ? inputText : null,
			},
		};

		if (input.includeEmbedding) {
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
			undefined,
		);

		return { ok: true, data: payload };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		telemetry.track(
			{
				event: "embed.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: message, duration_ms: Date.now() - startTime },
			},
			undefined,
		);
		return {
			ok: false,
			error: sdkError("embed.runtime_error", message),
		};
	}
}

const embedBuilder = new CommandBuilder<EmbedRunInput, EmbedRunResult>()
	.meta(embedMeta)
	.usage(embedUsage)
	.schema(embedSchema)
	.help(embedHelp)
	.sdkUsage(embedSdkUsage)
	.outputFields(embedOutputFields)
	.examples(embedExamples)
	.errors(embedErrors)
	.exitCodes(embedExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			model: { type: "string" },
			provider: { type: "string" },
			"include-embedding": { type: "boolean" },
			out: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		action: positionals[1] as "text" | "file" | undefined,
		input: positionals.slice(2).join(" ").trim() || undefined,
		model: typeof values.model === "string" ? values.model : undefined,
		provider: typeof values.provider === "string" ? values.provider : undefined,
		includeEmbedding: Boolean(values["include-embedding"]),
		out: typeof values.out === "string" ? values.out : undefined,
		json: values.json !== false,
	}))
	.run(run)
	.onSuccess(async (output, values) => {
		await renderJsonOrWrite(
			output,
			typeof values.out === "string" ? values.out : undefined,
		);
	})
	.onFailure((error) => {
		if (error.code.startsWith("embed.")) {
			console.error(`Error: ${error.message}`);
			setExitCode(error, [
				"embed.missing_action",
				"embed.missing_text",
				"embed.missing_path",
				"embed.unknown_action",
			]);
			return;
		}
		handleCommandError(error, [
			"embed.missing_action",
			"embed.missing_text",
			"embed.missing_path",
			"embed.unknown_action",
		]);
	})
	.telemetry({
		eventPrefix: "embed",
		successMetadata: (input, output) => ({
			input_type: output.input.type,
			model: output.model,
			provider: output.provider,
			include_embedding: Boolean(input.includeEmbedding),
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const embedAgentDoc = embedBuilder.buildAgentDoc(false);
export const embedFeatureDoc = (includeChangelog: boolean) =>
	embedBuilder.buildFeatureDoc(includeChangelog);

const embedCommand = embedBuilder.build();

export default embedCommand;
