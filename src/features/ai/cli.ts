import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import { openMcpDatabase } from "../../core/mcp/db";
import { executeMcpToolFromAi } from "../../core/mcp/integrations/ai";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { AiEngine } from "./engine";
import { MockProvider, OllamaProvider, OpenAiProvider } from "./providers/mod";
import type { AiStreamChunk, AiResponse } from "./types";

export const aiMeta: AgentDocMeta = {
	name: "ai",
	description: "Query the AI engine",
	changelog: [
		{ version: "1.1.0", changes: ["Added streaming support"] },
		{ version: "1.0.0", changes: ["Initial release"] },
	],
};

export const aiHelp = `
Usage: nooa ai <prompt> [flags]

Directly query the AI engine.

Arguments:
  <prompt>       The prompt text (required).

Flags:
  --provider <name>   Provider name (default: ollama, fallback: openai).
  --model <name>      Model name override.
  --json              Output as JSON.
  --stream            Stream output tokens to stdout (CLI).
  --mcp-source <name> MCP server to execute a tool.
  --mcp-tool <name>   Tool name exposed by the MCP server.
  --mcp-args <json>   Arguments to pass to the MCP tool (JSON).
  -h, --help          Show help.

Examples:
  nooa ai "Who are you?"
  nooa ai "Explain TDD" --provider openai
  nooa ai "Tell a joke" --json
`;

export const aiSdkUsage = `
SDK Usage:
  const result = await ai.run({ prompt: "Hello", provider: "ollama" });
  if (result.ok) console.log(result.data.content);
`;

export const aiUsage = {
	cli: "nooa ai <prompt> [flags]",
	sdk: "await ai.run({ prompt: \"Hello\" })",
	tui: "AiConsole()",
};

export const aiSchema = {
	prompt: { type: "string", required: true },
	provider: { type: "string", required: false },
	model: { type: "string", required: false },
	json: { type: "boolean", required: false },
	stream: { type: "boolean", required: false, since: "1.1.0" },
	"mcp-source": { type: "string", required: false },
	"mcp-tool": { type: "string", required: false },
	"mcp-args": { type: "string", required: false },
} satisfies SchemaSpec;

export const aiOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "content", type: "string" },
	{ name: "provider", type: "string" },
	{ name: "model", type: "string" },
	{ name: "usage", type: "string" },
	{ name: "server", type: "string" },
	{ name: "tool", type: "string" },
	{ name: "result", type: "string" },
];

export const aiErrors = [
	{ code: "ai.missing_prompt", message: "Prompt is required." },
	{ code: "ai.mcp_invalid_args", message: "MCP args must be valid JSON." },
	{ code: "ai.mcp_error", message: "Error invoking MCP tool." },
	{ code: "ai.runtime_error", message: "AI execution failed." },
];

export const aiExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const aiExamples = [
	{ input: 'nooa ai "Who are you?"', output: "AI response text" },
	{ input: 'nooa ai "Tell a joke" --json', output: "{ ... }" },
];

export interface AiRunInput {
	prompt?: string;
	provider?: string;
	model?: string;
	json?: boolean;
	stream?: boolean;
	"mcp-source"?: string;
	"mcp-tool"?: string;
	"mcp-args"?: string;
}

export type AiRunMode = "ai" | "mcp" | "help";

export interface AiRunResult {
	mode: AiRunMode;
	content?: string;
	provider?: string;
	model?: string;
	usage?: unknown;
	server?: string;
	tool?: string;
	result?: unknown;
}

function createEngine() {
	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new MockProvider());
	return engine;
}

export async function streamAi(
	input: AiRunInput,
): Promise<AsyncGenerator<AiStreamChunk, AiResponse, void>> {
	const engine = createEngine();
	return engine.stream(
		{
			messages: [{ role: "user", content: input.prompt ?? "" }],
			model: input.model,
		},
		{
			provider: input.provider,
			fallbackProvider: input.provider ? undefined : "openai",
		},
	);
}

export async function run(input: AiRunInput): Promise<SdkResult<AiRunResult>> {
	const prompt = input.prompt;
	if (!prompt) {
		return {
			ok: false,
			error: sdkError("ai.missing_prompt", "Prompt is required."),
		};
	}

	const mcpSource = input["mcp-source"];
	const mcpTool = input["mcp-tool"];
	const mcpArgsRaw = input["mcp-args"];
	if (mcpSource && mcpTool) {
		const db = openMcpDatabase();
		try {
			let args = {};
			if (mcpArgsRaw?.trim()) {
				try {
					args = JSON.parse(mcpArgsRaw);
				} catch {
					return {
						ok: false,
						error: sdkError(
							"ai.mcp_invalid_args",
							"MCP args must be valid JSON.",
						),
					};
				}
			}
			const toolResult = await executeMcpToolFromAi(db, mcpSource, mcpTool, args);
			return {
				ok: true,
				data: {
					mode: "mcp",
					server: mcpSource,
					tool: mcpTool,
					result: toolResult,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				error: sdkError("ai.mcp_error", `Error invoking MCP tool: ${message}`),
			};
		} finally {
			db.close();
		}
	}

	const engine = createEngine();

	try {
		if (input.stream && !input.json) {
			const iterator = await streamAi(input);
			let content = "";
			let finalResponse: AiResponse | undefined;

			while (true) {
				const next = await iterator.next();
				if (next.done) {
					finalResponse = next.value;
					break;
				}
				if (next.value?.content) {
					content += next.value.content;
					process.stdout.write(next.value.content);
				}
			}

			return {
				ok: true,
				data: {
					mode: "ai",
					content,
					provider: finalResponse?.provider ?? input.provider,
					model: finalResponse?.model ?? input.model,
					usage: finalResponse?.usage,
				},
			};
		}

		const response = await engine.complete(
			{
				messages: [{ role: "user", content: prompt }],
				model: input.model,
			},
			{
				provider: input.provider,
				fallbackProvider: input.provider ? undefined : "openai",
			},
		);

		return {
			ok: true,
			data: {
				mode: "ai",
				content: response.content,
				provider: response.provider,
				model: response.model,
				usage: response.usage,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("ai.runtime_error", errorMessage),
		};
	}
}

const aiBuilder = new CommandBuilder<AiRunInput, AiRunResult>()
	.meta(aiMeta)
	.usage(aiUsage)
	.schema(aiSchema)
	.help(aiHelp)
	.sdkUsage(aiSdkUsage)
	.outputFields(aiOutputFields)
	.examples(aiExamples)
	.errors(aiErrors)
	.exitCodes(aiExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			provider: { type: "string" },
			model: { type: "string" },
			stream: { type: "boolean" },
			"mcp-source": { type: "string" },
			"mcp-tool": { type: "string" },
			"mcp-args": { type: "string" },
		},
	})
	.parseInput(async ({ values, positionals }) => ({
		prompt: positionals[1],
		provider: values.provider as string | undefined,
		model: values.model as string | undefined,
		json: Boolean(values.json),
		stream: Boolean(values.stream),
		"mcp-source": values["mcp-source"] as string | undefined,
		"mcp-tool": values["mcp-tool"] as string | undefined,
		"mcp-args": values["mcp-args"] as string | undefined,
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (output.mode === "mcp") {
			if (values.json) {
				renderJson({
					server: output.server,
					tool: output.tool,
					result: output.result,
				});
			} else {
				console.log(
					`MCP ${output.server}.${output.tool} -> ${JSON.stringify(output.result)}`,
				);
			}
			return;
		}

		if (values.stream && !values.json) {
			if (output.content) {
				process.stdout.write("\n");
			}
			return;
		}

		if (values.json) {
			renderJson(output);
			return;
		}
		console.log(output.content ?? "");
	})
	.onFailure((error) => {
		handleCommandError(error, ["ai.missing_prompt", "ai.mcp_invalid_args"]);
	});

export const aiAgentDoc = aiBuilder.buildAgentDoc(false);
export const aiFeatureDoc = (includeChangelog: boolean) =>
	aiBuilder.buildFeatureDoc(includeChangelog);

export default aiBuilder.build();
