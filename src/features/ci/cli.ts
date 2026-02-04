import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJsonOrWrite
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { EventBus } from "../../core/event-bus";
import { executeCi } from "./execute";

export const ciMeta: AgentDocMeta = {
	name: "ci",
	description: "Run local CI pipeline (test + lint + check)",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const ciHelp = `
Usage: nooa ci [flags]

Run local CI pipeline (test + lint + policy check).

Flags:
  --json         Output results as JSON.
  --out <file>   Write results to a file.
  -h, --help     Show help message.

Examples:
  nooa ci
  nooa ci --json
  nooa ci --json --out .nooa/reports/ci.json

Exit Codes:
  0: Success
  1: Runtime Error (CI failed)

Error Codes:
  ci.failed: CI pipeline failed
  ci.runtime_error: CI execution failed
`;

export const ciSdkUsage = `
SDK Usage:
  const result = await ci.run({ json: true });
  if (result.ok) console.log(result.data.ok);
`;

export const ciUsage = {
	cli: "nooa ci [flags]",
	sdk: "await ci.run({ json: true })",
	tui: "CiConsole()",
};

export const ciSchema = {
	json: { type: "boolean", required: false },
	out: { type: "string", required: false },
} satisfies SchemaSpec;

export const ciOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "traceId", type: "string" },
	{ name: "stages", type: "string" },
	{ name: "duration_ms", type: "number" },
];

export const ciErrors = [
	{ code: "ci.failed", message: "CI pipeline failed." },
	{ code: "ci.runtime_error", message: "CI execution failed." },
];

export const ciExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
];

export const ciExamples = [
	{ input: "nooa ci", output: "Runs CI" },
	{ input: "nooa ci --json", output: "JSON report" },
];

export interface CiRunInput {
	json?: boolean;
	out?: string;
	bus?: EventBus;
}

export interface CiRunResult {
	ok: boolean;
	traceId: string;
	test: { passed: boolean; exitCode: number };
	lint: { passed: boolean; exitCode: number };
	check: { passed: boolean; violations: number };
	duration_ms: number;
}

export async function run(
	input: CiRunInput,
): Promise<SdkResult<CiRunResult>> {
	try {
		const result = await executeCi({ json: Boolean(input.json) }, input.bus);
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("ci.failed", "CI pipeline failed.", { result }),
			};
		}
		return { ok: true, data: result };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("ci.runtime_error", message),
		};
	}
}

const ciBuilder = new CommandBuilder<CiRunInput, CiRunResult>()
	.meta(ciMeta)
	.usage(ciUsage)
	.schema(ciSchema)
	.help(ciHelp)
	.sdkUsage(ciSdkUsage)
	.outputFields(ciOutputFields)
	.examples(ciExamples)
	.errors(ciErrors)
	.exitCodes(ciExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			out: { type: "string" },
		},
	})
	.parseInput(async ({ values, bus }) => ({
		json: Boolean(values.json),
		out: typeof values.out === "string" ? values.out : undefined,
		bus,
	}))
	.run(run)
	.onSuccess(async (output, values) => {
		if (!values.json) {
			console.log("🔍 Running CI pipeline...\n");
			console.log(
				output.test.passed
					? "✅ Tests passed"
					: `❌ Tests failed (exit: ${output.test.exitCode})`,
			);
			console.log(
				output.lint.passed
					? "✅ Lint passed"
					: `❌ Lint failed (exit: ${output.lint.exitCode})`,
			);
			console.log(
				output.check.passed
					? "✅ Policy check passed"
					: `❌ Policy violations: ${output.check.violations}`,
			);
			console.log(`\n⏱️  Duration: ${output.duration_ms}ms`);
			console.log(
				output.ok
					? `\n✅ CI passed [${output.traceId}]`
					: `\n❌ CI failed [${output.traceId}]`,
			);
			process.exitCode = output.ok ? 0 : 1;
			return;
		}
		const payload = {
			schemaVersion: "1.0",
			ok: output.ok,
			traceId: output.traceId,
			command: "ci",
			timestamp: new Date().toISOString(),
			stages: {
				test: output.test,
				lint: output.lint,
				check: output.check,
			},
			duration_ms: output.duration_ms,
		};
		await renderJsonOrWrite(
			payload,
			typeof values.out === "string" ? values.out : undefined,
		);
		process.exitCode = output.ok ? 0 : 1;
	})
	.onFailure((error) => {
		if (error.code === "ci.failed") {
			process.exitCode = 1;
			return;
		}
		handleCommandError(error, []);
	})
	.telemetry({
		eventPrefix: "ci",
		successMetadata: (_, output) => ({
			ok: output.ok,
			duration_ms: output.duration_ms,
		}),
		failureMetadata: (_, error) => ({
			error: error.message,
		}),
	});

export const ciAgentDoc = ciBuilder.buildAgentDoc(false);
export const ciFeatureDoc = (includeChangelog: boolean) =>
	ciBuilder.buildFeatureDoc(includeChangelog);

const ciCommand = ciBuilder.build();

export default ciCommand;
