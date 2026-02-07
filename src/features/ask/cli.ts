import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";

import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { executeSearch } from "../index/execute";

export const askMeta: AgentDocMeta = {
	name: "ask",
	description: "Query indexed code/memory",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const askHelp = `
Usage: nooa ask <query> [flags]

Search code and memory using semantic similarity.

Flags:
  --limit <n>    Limit result count (default: 5).
  --json         Output results as JSON.
  -h, --help     Show help message.

Exit Codes:
  0: Success
  1: Runtime Error (search failed)
  2: Validation Error (missing query)

Error Codes:
  ask.missing_query: Query required
  ask.runtime_error: Search failed
`;

export const askSdkUsage = `
SDK Usage:
  const result = await ask.run({ query: "find TODOs", limit: 5 });
  if (result.ok) console.log(result.data.results.length);
`;

export const askUsage = {
	cli: "nooa ask <query> [flags]",
	sdk: 'await ask.run({ query: "find TODOs", limit: 5 })',
	tui: "AskPanel()",
};

export const askSchema = {
	query: { type: "string", required: true },
	limit: { type: "number", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const askOutputFields = [
	{ name: "query", type: "string" },
	{ name: "results", type: "string" },
];

export const askErrors = [
	{ code: "ask.missing_query", message: "Query required." },
	{ code: "ask.runtime_error", message: "Search failed." },
];

export const askExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const askExamples = [
	{
		input: 'nooa ask "find TODOs"',
		output: "Search indexed code and memory for 'find TODOs'.",
	},
	{
		input: "nooa ask init --json",
		output: "Search for 'init' relevance and return results as JSON.",
	},
];

export interface AskRunInput {
	query?: string;
	limit?: number;
	json?: boolean;
}

export interface AskRunResult {
	query: string;
	results: Awaited<ReturnType<typeof executeSearch>>;
}

export async function run(
	input: AskRunInput,
): Promise<SdkResult<AskRunResult>> {
	if (!input.query) {
		return {
			ok: false,
			error: sdkError("ask.missing_query", "Query required."),
		};
	}

	try {
		const limit = typeof input.limit === "number" ? input.limit : 5;
		const results = await executeSearch(input.query, limit);
		return { ok: true, data: { query: input.query, results } };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("ask.runtime_error", message),
		};
	}
}

const askBuilder = new CommandBuilder<AskRunInput, AskRunResult>()
	.meta(askMeta)
	.usage(askUsage)
	.schema(askSchema)
	.help(askHelp)
	.sdkUsage(askSdkUsage)
	.outputFields(askOutputFields)
	.examples(askExamples)
	.errors(askErrors)
	.exitCodes(askExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			limit: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values }) => {
		const query = positionals.slice(1).join(" ");
		const limitValue = typeof values.limit === "string" ? values.limit : "5";
		const limit = Number.parseInt(limitValue, 10);
		return {
			query: query || undefined,
			limit: Number.isNaN(limit) ? 5 : limit,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output.results);
			return;
		}
		console.log(`\n🔍 Results for: "${output.query}"\n`);
		for (const res of output.results) {
			console.log(`📄 ${res.path} (score: ${res.score.toFixed(4)})`);
			console.log(`   ${res.chunk.substring(0, 200).replace(/\n/g, " ")}...`);
			console.log("");
		}
	})
	.onFailure((error, _input) => {
		if (error.code === "ask.missing_query") {
			console.error("Error: Query required.");
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["ask.missing_query"]);
	})
	.telemetry({
		eventPrefix: "ask",
		successMetadata: (input, output) => ({
			query: input.query,
			results: output.results.length,
		}),
		failureMetadata: (input, error) => ({
			query: input.query,
			error: error.message,
		}),
	});

export const askAgentDoc = askBuilder.buildAgentDoc(false);
export const askFeatureDoc = (includeChangelog: boolean) =>
	askBuilder.buildFeatureDoc(includeChangelog);

const askCommand = askBuilder.build();

export default askCommand;
