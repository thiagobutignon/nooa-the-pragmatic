import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";

import { logger } from "../../core/logger";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { EventBus } from "../../core/event-bus";
import { executeDoctorCheck } from "./execute";

export const doctorMeta: AgentDocMeta = {
	name: "doctor",
	description: "Check environment health",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const doctorHelp = `
Usage: nooa doctor [flags]

Check development environment health.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa doctor
  nooa doctor --json

Exit Codes:
  0: All tools available
  1: One or more tools missing

Error Codes:
  doctor.failed: One or more tools missing
  doctor.runtime_error: Execution failed
`;

export const doctorSdkUsage = `
SDK Usage:
  const result = await doctor.run({ json: true });
  if (result.ok) console.log(result.data.ok);
`;

export const doctorUsage = {
	cli: "nooa doctor [flags]",
	sdk: "await doctor.run({ json: true })",
	tui: "DoctorConsole()",
};

export const doctorSchema = {
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const doctorOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "traceId", type: "string" },
	{ name: "tools", type: "string" },
	{ name: "duration_ms", type: "number" },
];

export const doctorErrors = [
	{ code: "doctor.failed", message: "One or more tools missing." },
	{ code: "doctor.runtime_error", message: "Execution failed." },
];

export const doctorExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
];

export const doctorExamples = [
	{ input: "nooa doctor", output: "Check the health of the development environment." },
	{ input: "nooa doctor --json", output: "Run environment check and output JSON report." },
];

export interface DoctorRunInput {
	json?: boolean;
	bus?: EventBus;
}

export interface DoctorRunResult {
	ok: boolean;
	traceId: string;
	bun: { available: boolean; version?: string };
	git: { available: boolean; version?: string };
	rg: { available: boolean; version?: string };
	sqlite: { available: boolean; version?: string };
	duration_ms: number;
}

export async function run(
	input: DoctorRunInput,
): Promise<SdkResult<DoctorRunResult>> {
	try {
		const result = await executeDoctorCheck(input.bus);
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("doctor.failed", "One or more tools missing.", {
					result,
				}),
			};
		}
		return { ok: true, data: result };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("doctor.error", new Error(message));
		return {
			ok: false,
			error: sdkError("doctor.runtime_error", message),
		};
	}
}

const doctorBuilder = new CommandBuilder<DoctorRunInput, DoctorRunResult>()
	.meta(doctorMeta)
	.usage(doctorUsage)
	.schema(doctorSchema)
	.help(doctorHelp)
	.sdkUsage(doctorSdkUsage)
	.outputFields(doctorOutputFields)
	.examples(doctorExamples)
	.errors(doctorErrors)
	.exitCodes(doctorExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ values, bus }) => ({
		json: Boolean(values.json),
		bus,
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({
				schemaVersion: "1.0",
				ok: output.ok,
				traceId: output.traceId,
				command: "doctor",
				timestamp: new Date().toISOString(),
				tools: {
					bun: output.bun,
					git: output.git,
					rg: output.rg,
					sqlite: output.sqlite,
				},
				duration_ms: output.duration_ms,
			});
			process.exitCode = output.ok ? 0 : 1;
			return;
		}

		console.log("🔍 Checking environment...\n");
		console.log(
			output.bun.available
				? `✅ bun: ${output.bun.version}`
				: "❌ bun: not found",
		);
		console.log(
			output.git.available
				? `✅ git: ${output.git.version}`
				: "❌ git: not found",
		);
		console.log(
			output.rg.available
				? `✅ ripgrep: ${output.rg.version}`
				: "❌ ripgrep: not found (install via: brew install ripgrep)",
		);
		console.log(
			output.sqlite.available
				? `✅ sqlite3: ${output.sqlite.version}`
				: "❌ sqlite3: not found",
		);
		console.log(`\n⏱️  Duration: ${output.duration_ms}ms`);
		console.log(
			output.ok
				? `\n✅ Environment healthy [${output.traceId}]`
				: `\n❌ Issues found [${output.traceId}]`,
		);
		process.exitCode = output.ok ? 0 : 1;
	})
	.onFailure((error) => {
		if (error.code === "doctor.failed") {
			process.exitCode = 1;
			return;
		}
		handleCommandError(error, []);
	})
	.telemetry({
		eventPrefix: "doctor",
		successMetadata: (_, output) => ({
			ok: output.ok,
			duration_ms: output.duration_ms,
		}),
		failureMetadata: (_, error) => ({
			error: error.message,
		}),
	});

export const doctorAgentDoc = doctorBuilder.buildAgentDoc(false);
export const doctorFeatureDoc = (includeChangelog: boolean) =>
	doctorBuilder.buildFeatureDoc(includeChangelog);

const doctorCommand = doctorBuilder.build();

export default doctorCommand;
