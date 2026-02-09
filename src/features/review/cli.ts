import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson,
	renderJsonOrWrite,
	setExitCode,
} from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { EventBus } from "../../core/event-bus";
import { createTraceId, logger } from "../../core/logger";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { executeReview, type ReviewResult } from "./execute";

export const reviewMeta: AgentDocMeta = {
	name: "review",
	description: "Perform a code review",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const reviewHelp = `
Usage: nooa review [path] [flags]

Perform an AI-powered code review of a file or staged changes.

Arguments:
  [path]              Path to a file to review. If omitted, staged changes are reviewed.

Flags:
  --prompt <name>     Use a specific prompt template (default: review).
  --json              Output as structured JSON.
  --out <file>        Save output to a file (especially useful with --json).
  --fail-on <level>   Exit with code 1 if findings with severity >= level are found.
                      (Levels: low, medium, high)
  -h, --help          Show help message.

Examples:
  nooa review src/index.ts
  nooa review --json --out review-results.json
  nooa review --fail-on high

Exit Codes:
  0: Success
  1: Runtime Error (AI failure or parsing issues)
  2: Validation Error (missing input or invalid severity)

Error Codes:
  review.no_input: No input source provided
  review.not_found: File not found
  review.invalid_severity: Invalid fail-on level
  review.runtime_error: Review failed
`;

export const reviewSdkUsage = `
SDK Usage:
  const result = await review.run({ path: "src/index.ts", prompt: "review" });
  if (result.ok) console.log(result.data.content);
`;

export const reviewUsage = {
	cli: "nooa review [path] [flags]",
	sdk: 'await review.run({ path: "src/index.ts" })',
	tui: "ReviewConsole()",
};

export const reviewSchema = {
	path: { type: "string", required: false },
	prompt: { type: "string", required: false },
	json: { type: "boolean", required: false },
	out: { type: "string", required: false },
	"fail-on": { type: "string", required: false },
} satisfies SchemaSpec;

export const reviewOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "traceId", type: "string" },
	{ name: "content", type: "string" },
	{ name: "result", type: "string" },
];

export const reviewErrors = [
	{ code: "review.no_input", message: "No input source provided." },
	{ code: "review.not_found", message: "File not found." },
	{
		code: "review.invalid_severity",
		message: "Invalid severity level. Use low, medium, or high.",
	},
	{ code: "review.runtime_error", message: "Review failed." },
];

export const reviewExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const reviewExamples = [
	{
		input: "nooa review src/index.ts",
		output: "Perform an AI code review on 'src/index.ts'.",
	},
	{
		input: "nooa review --json --out review-results.json",
		output: "Review changes and export findings to 'review-results.json'.",
	},
	{
		input: "nooa review --fail-on high",
		output: "Review changes and fail if high severity issues found.",
	},
];

export interface ReviewRunInput {
	path?: string;
	prompt?: string;
	json?: boolean;
	out?: string;
	failOn?: string;
	bus?: EventBus;
}

export interface ReviewRunResult {
	ok: boolean;
	traceId: string;
	content: string;
	result?: ReviewResult;
}

const severityLevels = ["low", "medium", "high"] as const;

export async function run(
	input: ReviewRunInput,
): Promise<SdkResult<ReviewRunResult>> {
	const traceId = createTraceId();
	try {
		const { content, result } = await executeReview(
			{
				path: input.path,
				staged: !input.path,
				json: Boolean(input.json),
				prompt: input.prompt,
				failOn: input.failOn,
				traceId,
			},
			input.bus,
		);
		return {
			ok: true,
			data: {
				ok: Boolean(result),
				traceId,
				content,
				result,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const isNoInput = message.includes("No input source");
		const isNotFound = message.includes("not found");
		if (isNoInput) {
			return {
				ok: false,
				error: sdkError("review.no_input", message, { traceId }),
			};
		}
		if (isNotFound) {
			return {
				ok: false,
				error: sdkError("review.not_found", message, { traceId }),
			};
		}
		return {
			ok: false,
			error: sdkError("review.runtime_error", message, { traceId }),
		};
	}
}

const reviewBuilder = new CommandBuilder<ReviewRunInput, ReviewRunResult>()
	.meta(reviewMeta)
	.usage(reviewUsage)
	.schema(reviewSchema)
	.help(reviewHelp)
	.sdkUsage(reviewSdkUsage)
	.outputFields(reviewOutputFields)
	.examples(reviewExamples)
	.errors(reviewErrors)
	.exitCodes(reviewExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			prompt: { type: "string" },
			out: { type: "string" },
			"fail-on": { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values, bus }) => ({
		path: positionals[1],
		prompt: typeof values.prompt === "string" ? values.prompt : undefined,
		json: Boolean(values.json),
		out: typeof values.out === "string" ? values.out : undefined,
		failOn:
			typeof values["fail-on"] === "string" ? values["fail-on"] : undefined,
		bus,
	}))
	.run(run)
	.onSuccess(async (output, values) => {
		const jsonMode = Boolean(values.json);
		if (jsonMode) {
			const payload = {
				schemaVersion: "1.0",
				ok: output.ok,
				traceId: output.traceId,
				command: "review",
				timestamp: new Date().toISOString(),
				...(output.result ?? {}),
			};
			await renderJsonOrWrite(
				payload,
				typeof values.out === "string" ? values.out : undefined,
			);
		} else if (values.out) {
			const { writeFile } = await import("node:fs/promises");
			await writeFile(values.out as string, output.content, "utf-8");
		} else {
			console.log(output.content);
		}

		if (jsonMode && !output.result) {
			process.exitCode = 1;
			return;
		}

		if (values["fail-on"] && output.result) {
			const minLevelIdx = severityLevels.indexOf(
				values["fail-on"] as (typeof severityLevels)[number],
			);
			if (minLevelIdx === -1) {
				console.error(`Error: Invalid severity level '${values["fail-on"]}'.`);
				process.exitCode = 2;
				return;
			}
			const highSeverityIssues = output.result.findings.filter(
				(f) => severityLevels.indexOf(f.severity) >= minLevelIdx,
			);
			if (highSeverityIssues.length > 0) {
				if (!jsonMode && !values.out) {
					console.error(
						`\nFound ${highSeverityIssues.length} issues with severity >= ${values["fail-on"]}.`,
					);
				}
				process.exitCode = 1;
			}
		}
	})
	.onFailure((error, input) => {
		if (input.json) {
			const traceId =
				typeof error.details?.traceId === "string"
					? error.details.traceId
					: logger.getContext().trace_id;
			renderJson({
				schemaVersion: "1.0",
				ok: false,
				traceId,
				command: "review",
				timestamp: new Date().toISOString(),
				error: error.message,
			});
			setExitCode(error, [
				"review.no_input",
				"review.not_found",
				"review.invalid_severity",
			]);
			return;
		}
		if (error.code === "review.invalid_severity") {
			console.error(`Error: ${error.message}`);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, [
			"review.no_input",
			"review.not_found",
			"review.invalid_severity",
		]);
	})
	.telemetry({
		eventPrefix: "review",
		successMetadata: (_, output) => ({
			ok: output.ok,
			findings_count: output.result?.findings.length ?? 0,
		}),
		failureMetadata: (input, error) => ({
			path: input.path,
			error: error.message,
		}),
	});

export const reviewAgentDoc = reviewBuilder.buildAgentDoc(false);
export const reviewFeatureDoc = (includeChangelog: boolean) =>
	reviewBuilder.buildFeatureDoc(includeChangelog);

const reviewCommand = reviewBuilder.build();

export default reviewCommand;
