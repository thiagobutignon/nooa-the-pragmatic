import { relative, resolve } from "node:path";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";

import { logger } from "../../core/logger";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import {
	clearIndex,
	getIndexStats,
	indexFile,
	indexRepo,
	rebuildIndex,
} from "./execute";

export const indexMeta: AgentDocMeta = {
	name: "index",
	description: "Semantic indexing operations",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const indexHelp = `
Usage: nooa index [subcommand] [flags]

Semantic indexing for code and memory.

Subcommands:
  repo     Index all TypeScript and Markdown files in the repository.
  file     Index a specific file.
  clear    Clear the index.
  stats    Show index statistics.
  rebuild  Clear and rebuild the index.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa index repo
  nooa index file src/index.ts
  nooa index stats --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  index.missing_command: Subcommand required
  index.missing_path: File path required
  index.runtime_error: Index operation failed
`;

export const indexSdkUsage = `
SDK Usage:
  await index.run({ action: "repo" });
  await index.run({ action: "file", path: "src/index.ts" });
`;

export const indexUsage = {
	cli: "nooa index [subcommand] [flags]",
	sdk: 'await index.run({ action: "repo" })',
	tui: "IndexConsole()",
};

export const indexSchema = {
	action: { type: "string", required: true },
	path: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const indexOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "result", type: "string" },
];

export const indexErrors = [
	{ code: "index.missing_command", message: "Subcommand required." },
	{ code: "index.missing_path", message: "File path required." },
	{ code: "index.runtime_error", message: "Index operation failed." },
];

export const indexExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const indexExamples = [
	{
		input: "nooa index repo",
		output: "Index all TypeScript and Markdown files in the repository.",
	},
	{
		input: "nooa index file src/index.ts",
		output: "Index the specific file 'src/index.ts'.",
	},
];

export interface IndexRunInput {
	action?: string;
	path?: string;
	json?: boolean;
}

export interface IndexRunResult {
	mode: string;
	result: unknown;
}

export async function run(
	input: IndexRunInput,
): Promise<SdkResult<IndexRunResult>> {
	const action = input.action;
	if (!action) {
		return {
			ok: false,
			error: sdkError("index.missing_command", "Subcommand required."),
		};
	}

	try {
		if (action === "repo") {
			const result = await indexRepo();
			return { ok: true, data: { mode: "repo", result } };
		}
		if (action === "file") {
			const file = input.path;
			if (!file) {
				return {
					ok: false,
					error: sdkError("index.missing_path", "File path required."),
				};
			}
			const fullPath = resolve(process.cwd(), file);
			const relPath = relative(process.cwd(), fullPath);
			const result = await indexFile(fullPath, relPath);
			return { ok: true, data: { mode: "file", result } };
		}
		if (action === "clear") {
			const result = await clearIndex();
			return { ok: true, data: { mode: "clear", result } };
		}
		if (action === "stats") {
			const result = await getIndexStats();
			return { ok: true, data: { mode: "stats", result } };
		}
		if (action === "rebuild") {
			const result = await rebuildIndex();
			return { ok: true, data: { mode: "rebuild", result } };
		}

		return {
			ok: false,
			error: sdkError("index.missing_command", "Unknown subcommand."),
		};
	} catch (error) {
		logger.error("index.error", error as Error);
		return {
			ok: false,
			error: sdkError("index.runtime_error", "Index operation failed."),
		};
	}
}

export const indexBuilder = new CommandBuilder<IndexRunInput, IndexRunResult>()
	.meta(indexMeta)
	.usage(indexUsage)
	.schema(indexSchema)
	.help(indexHelp)
	.sdkUsage(indexSdkUsage)
	.outputFields(indexOutputFields)
	.examples(indexExamples)
	.errors(indexErrors)
	.exitCodes(indexExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values }) => ({
		action: positionals[1],
		path: positionals[2],
		json: Boolean(values.json),
	}))
	.run(run)
	.onSuccess((output, values, input) => {
		if (values.json) {
			renderJson(output.result);
			return;
		}

		switch (output.mode) {
			case "repo": {
				const result = output.result as {
					files: number;
					totalChunks: number;
					traceId: string;
				};
				console.log("🔍 Indexing repository (TypeScript/Markdown)...");
				console.log("✅ Indexing complete!");
				console.log(`   Files: ${result.files}`);
				console.log(`   Chunks: ${result.totalChunks}`);
				console.log(`   Trace ID: ${result.traceId}`);
				return;
			}
			case "file": {
				const result = output.result as { chunks: number };
				console.log(`✅ Indexed ${input.path} (${result.chunks} chunks)`);
				return;
			}
			case "clear": {
				console.log("✅ Index cleared.");
				return;
			}
			case "stats": {
				const stats = output.result as { documents: number; chunks: number };
				console.log("📊 Index Stats:");
				console.log(`   Documents: ${stats.documents}`);
				console.log(`   Chunks:    ${stats.chunks}`);
				return;
			}
			case "rebuild": {
				const result = output.result as { totalChunks: number };
				console.log("🔄 Rebuilding index...");
				console.log(`✅ Rebuild complete! (${result.totalChunks} chunks)`);
				return;
			}
			default:
				break;
		}
	})
	.onFailure((error) => {
		if (error.code === "index.missing_command") {
			console.log(indexHelp);
			process.exitCode = 2;
			return;
		}
		if (error.code === "index.missing_path") {
			console.error("❌ File path required");
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["index.missing_command", "index.missing_path"]);
	})
	.telemetry({
		eventPrefix: "index",
		successMetadata: (input, output) => ({
			action: output.mode,
			path: input.path,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const indexAgentDoc = indexBuilder.buildAgentDoc(false);
export const indexFeatureDoc = (includeChangelog: boolean) =>
	indexBuilder.buildFeatureDoc(includeChangelog);

const indexCommand = indexBuilder.build();

export default indexCommand;
