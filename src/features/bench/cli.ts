import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { runBenchInspect as runBenchExecute } from "./execute";

export type BenchAction = "inspect" | "help";

export const benchMeta: AgentDocMeta = {
	name: "bench",
	description: "Capture benchmark repeated command execution for local commands",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const benchHelp = `
Usage: nooa bench <subcommand> [flags] -- <command...>

Capture benchmark repeated command execution for local commands.

Subcommands:
  inspect              Run a command repeatedly and summarize duration statistics.

Flags:
  --runs <n>           Number of runs to execute (default: 3).
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa bench inspect --runs 3 -- node script.js
  nooa bench inspect -- bun test src/features/debug

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  bench.missing_subcommand: Missing subcommand.
  bench.invalid_target: Unsupported or missing runtime command.
  bench.runtime_error: Bench capture failed.
`;

export const benchSdkUsage = `
SDK Usage:
  const result = await bench.run({ action: "inspect", runs: 3, command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.benchId);
`;

export const benchUsage = {
	cli: "nooa bench <subcommand> [flags] -- <command...>",
	sdk: 'await bench.run({ action: "inspect", runs: 3, command: ["node", "script.js"] })',
	tui: "BenchConsole()",
};

export const benchSchema = {
	action: { type: "string", required: true },
	command: { type: "array", required: false },
	runs: { type: "number", required: false, default: 3 },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const benchOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "benchId", type: "string" },
	{ name: "runs", type: "number" },
	{ name: "traceIds", type: "array" },
	{ name: "durationStats", type: "object" },
	{ name: "successRate", type: "number" },
];

export const benchErrors = [
	{ code: "bench.missing_subcommand", message: "Missing subcommand." },
	{
		code: "bench.invalid_target",
		message: "Unsupported or missing runtime command.",
	},
	{ code: "bench.runtime_error", message: "Bench capture failed." },
];

export const benchExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const benchExamples = [
	{
		input: "nooa bench inspect --runs 3 -- node script.js",
		output: "Run a command repeatedly and summarize duration statistics.",
	},
];

export interface BenchRunInput {
	action?: BenchAction;
	command?: string[];
	runs?: number;
	json?: boolean;
	cwd?: string;
}

export interface BenchRunResult {
	mode: string;
	raw?: string;
	benchId?: string;
	runs?: number;
	traceIds?: string[];
	durationStats?: {
		minMs: number;
		medianMs: number;
		maxMs: number;
	};
	successRate?: number;
}

export async function benchRun(
	input: BenchRunInput,
): Promise<SdkResult<BenchRunResult>> {
	if (!input.action) {
		return {
			ok: false,
			error: sdkError("bench.missing_subcommand", "Missing subcommand."),
		};
	}

	if (input.action === "help") {
		return {
			ok: true,
			data: {
				mode: "help",
				raw: benchHelp,
			},
		};
	}

	return await runBenchExecute(input);
}

const benchBuilder = new CommandBuilder<BenchRunInput, BenchRunResult>()
	.meta(benchMeta)
	.usage(benchUsage)
	.schema(benchSchema)
	.help(benchHelp)
	.sdkUsage(benchSdkUsage)
	.outputFields(benchOutputFields)
	.examples(benchExamples)
	.errors(benchErrors)
	.exitCodes(benchExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			runs: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values, rawArgs }) => {
		const sourceArgs = rawArgs ?? positionals;
		const delimiterIndex = sourceArgs.indexOf("--");
		return {
			action: (positionals[1] as BenchAction | undefined) ?? undefined,
			command: delimiterIndex >= 0 ? sourceArgs.slice(delimiterIndex + 1) : [],
			runs: values.runs ? Number(values.runs) : 3,
			json: Boolean(values.json),
		};
	})
	.run(benchRun)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		if (output.mode === "help" && output.raw) {
			console.log(output.raw);
			return;
		}
		console.log(`Bench: ${output.benchId}`);
		console.log(`Runs: ${output.runs}`);
		console.log(`Success rate: ${output.successRate ?? 0}`);
		if (output.durationStats) {
			console.log(
				`Duration: min=${output.durationStats.minMs}ms median=${output.durationStats.medianMs}ms max=${output.durationStats.maxMs}ms`,
			);
		}
	})
	.onFailure((error) => {
		if (error.code === "bench.missing_subcommand") {
			console.log(benchHelp);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["bench.missing_subcommand", "bench.invalid_target"]);
	})
	.telemetry({
		eventPrefix: "bench",
		successMetadata: (_, output) => ({
			mode: output.mode,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const benchAgentDoc = benchBuilder.buildAgentDoc(false);
export const benchFeatureDoc = (includeChangelog: boolean) =>
	benchBuilder.buildFeatureDoc(includeChangelog);

const benchCommand = benchBuilder.build();

export default benchCommand;
