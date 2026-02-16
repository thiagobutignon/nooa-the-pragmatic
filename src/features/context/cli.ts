import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";

import { logger } from "../../core/logger";
import { getMcpResourcesForContext } from "../../core/mcp/integrations/context";
import type { McpResource } from "../../core/mcp/types";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { buildContext } from "./execute";

export const contextMeta: AgentDocMeta = {
	name: "context",
	description: "Generate AI context pack",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const contextHelp = `
Usage: nooa context <file|symbol> [flags]

Generate context pack for AI consumption.

Flags:
  --json         Output results as JSON.
  --include-mcp  Include MCP resource metadata.
  -h, --help     Show help message.

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error (missing target)

Error Codes:
  context.missing_target: File or symbol required
  context.runtime_error: Context build failed
`;

export const contextSdkUsage = `
SDK Usage:
  const result = await context.run({ target: "src/index.ts" });
  if (result.ok) console.log(result.data.target);
`;

export const contextUsage = {
	cli: "nooa context <file|symbol> [flags]",
	sdk: 'await context.run({ target: "src/index.ts" })',
	tui: "ContextConsole()",
};

export const contextSchema = {
	target: { type: "string", required: true },
	json: { type: "boolean", required: false },
	"include-mcp": { type: "boolean", required: false },
} satisfies SchemaSpec;

export const contextOutputFields = [
	{ name: "target", type: "string" },
	{ name: "related", type: "string" },
	{ name: "tests", type: "string" },
	{ name: "symbols", type: "string" },
	{ name: "recentCommits", type: "string" },
	{ name: "mcpResources", type: "string" },
];

export const contextErrors = [
	{ code: "context.missing_target", message: "File or symbol required." },
	{ code: "context.runtime_error", message: "Context build failed." },
];

export const contextExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const contextExamples = [
	{
		input: 'nooa context "Context summary"',
		output: "Generate a context summary for AI consumption.",
	},
	{
		input: 'nooa context "JSON output" --json',
		output: "Generate context for 'JSON output' and return as JSON.",
	},
];

export interface ContextRunInput {
	target?: string;
	json?: boolean;
	includeMcp?: boolean;
}

export interface ContextRunResult {
	target: string;
	related: string[];
	tests: string[];
	symbols: string[];
	recentCommits: string[];
	mcpResources?: McpResource[];
	timestamp: number;
}

export async function run(
	input: ContextRunInput,
): Promise<SdkResult<ContextRunResult>> {
	if (!input.target) {
		return {
			ok: false,
			error: sdkError("context.missing_target", "File or symbol required."),
		};
	}

	try {
		const result = await buildContext(input.target);
		const includeMcp = Boolean(input.includeMcp);
		let mcpResources: McpResource[] | undefined;
		if (includeMcp) {
			const dbPath = process.env.NOOA_DB_PATH || ".nooa/nooa.db";
			mkdirSync(dirname(dbPath), { recursive: true });
			const db = new Database(dbPath, { create: true });
			try {
				mcpResources = await getMcpResourcesForContext(db);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.warn("MCP resources unavailable", { error: message });
				mcpResources = [];
			} finally {
				db.close();
			}
		}

		return {
			ok: true,
			data: {
				...result,
				mcpResources,
				timestamp: Date.now(),
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("context.runtime_error", message),
		};
	}
}

const contextBuilder = new CommandBuilder<ContextRunInput, ContextRunResult>()
	.meta(contextMeta)
	.usage(contextUsage)
	.schema(contextSchema)
	.help(contextHelp)
	.sdkUsage(contextSdkUsage)
	.outputFields(contextOutputFields)
	.examples(contextExamples)
	.errors(contextErrors)
	.exitCodes(contextExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			"include-mcp": { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		target: positionals[1],
		json: Boolean(values.json),
		includeMcp: Boolean(values["include-mcp"]),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({ ok: true, ...output });
			return;
		}

		console.log(`Target: ${output.target}`);
		console.log(`Related: ${output.related.join(", ") || "none"}`);
		console.log(`Tests: ${output.tests.join(", ") || "none"}`);
		console.log(`Symbols: ${output.symbols.join(", ") || "none"}`);
		console.log(`Recent Commits: ${output.recentCommits.length}`);
		if (output.mcpResources) {
			console.log(
				`MCP Resources: ${
					output.mcpResources.map((r) => r.name).join(", ") || "none"
				}`,
			);
		}
	})
	.onFailure((error, input) => {
		if (error.code === "context.missing_target") {
			const msg = "Error: File or symbol required.";
			if (input.json) {
				renderJson({
					ok: false,
					error: msg,
					traceId: logger.getContext().trace_id,
					schemaVersion: "1.0.0",
					timestamp: Date.now(),
				});
			} else {
				console.error(msg);
			}
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["context.missing_target"]);
	})
	.telemetry({
		eventPrefix: "context",
		successMetadata: (input, output) => ({
			target: output.target,
			include_mcp: Boolean(input.includeMcp),
		}),
		failureMetadata: (input, error) => ({
			target: input.target,
			error: error.message,
		}),
	});

export const contextAgentDoc = contextBuilder.buildAgentDoc(false);
export const contextFeatureDoc = (includeChangelog: boolean) =>
	contextBuilder.buildFeatureDoc(includeChangelog);

const contextCommand = contextBuilder.build();

export default contextCommand;
