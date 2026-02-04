import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJsonOrWrite
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import * as readline from "node:readline/promises";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { executeInit } from "./execute";

export const initMeta: AgentDocMeta = {
	name: "init",
	description: "Initialize NOOA's Agentic Soul and Identity",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const initHelp = `
Usage: nooa init [flags]

Initialize NOOA's Agentic Soul and Identity.

Flags:
  --name <name>         Name of the agent (default: NOOA).
  --vibe <vibe>         Vibe of the agent (snarky, protocol, resourceful).
  --user-name <name>    What the agent should call you.
  --root <path>         Project root directory.
  --force               Overwrite existing configuration.
  --dry-run             Do not write files.
  --non-interactive     Skip interactive prompts.
  --out <path>          Write JSON output to file.
  --json                Output results as JSON.
  -h, --help            Show help message.

Examples:
  nooa init
  nooa init --name "NOOA-Pragmatic" --vibe "snarky" --non-interactive

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  init.already_exists: .nooa directory already exists
  init.runtime_error: Init failed
`;

export const initSdkUsage = `
SDK Usage:
  const result = await init.run({ name: "NOOA", vibe: "resourceful" });
  if (result.ok) console.log(result.data.results);
`;

export const initUsage = {
	cli: "nooa init [flags]",
	sdk: "await init.run({ name: \"NOOA\" })",
	tui: "InitConsole()",
};

export const initSchema = {
	name: { type: "string", required: false },
	vibe: { type: "string", required: false },
	"user-name": { type: "string", required: false },
	root: { type: "string", required: false },
	force: { type: "boolean", required: false },
	"dry-run": { type: "boolean", required: false },
	"non-interactive": { type: "boolean", required: false },
	out: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const initOutputFields = [
	{ name: "traceId", type: "string" },
	{ name: "results", type: "string" },
	{ name: "dryRun", type: "boolean" },
	{ name: "name", type: "string" },
	{ name: "vibe", type: "string" },
	{ name: "userName", type: "string" },
];

export const initErrors = [
	{ code: "init.already_exists", message: ".nooa directory already exists." },
	{ code: "init.runtime_error", message: "Init failed." },
];

export const initExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const initExamples = [
	{ input: "nooa init", output: "Identity initialized" },
	{ input: "nooa init --force", output: "Overwrite identity" },
];

export interface InitRunInput {
	name?: string;
	vibe?: string;
	userName?: string;
	root?: string;
	force?: boolean;
	dryRun?: boolean;
	nonInteractive?: boolean;
	out?: string;
	json?: boolean;
}

export interface InitRunResult {
	traceId: string;
	results: string[];
	dryRun: boolean;
	name: string;
	vibe: string;
	userName: string;
}

export async function run(
	input: InitRunInput,
): Promise<SdkResult<InitRunResult>> {
	try {
		const { results, traceId } = await executeInit({
			name: input.name,
			vibe: input.vibe,
			userName: input.userName,
			root: input.root,
			force: input.force,
			dryRun: input.dryRun,
		});

		return {
			ok: true,
			data: {
				traceId,
				results,
				dryRun: Boolean(input.dryRun),
				name: input.name || "NOOA",
				vibe: input.vibe || "resourceful",
				userName: input.userName || "Developer",
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("already exists")) {
			return {
				ok: false,
				error: sdkError("init.already_exists", message),
			};
		}
		return {
			ok: false,
			error: sdkError("init.runtime_error", message),
		};
	}
}

const initBuilder = new CommandBuilder<InitRunInput, InitRunResult>()
	.meta(initMeta)
	.usage(initUsage)
	.schema(initSchema)
	.help(initHelp)
	.sdkUsage(initSdkUsage)
	.outputFields(initOutputFields)
	.examples(initExamples)
	.errors(initErrors)
	.exitCodes(initExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			name: { type: "string" },
			vibe: { type: "string" },
			"user-name": { type: "string" },
			root: { type: "string" },
			force: { type: "boolean" },
			"dry-run": { type: "boolean" },
			"non-interactive": { type: "boolean" },
			out: { type: "string" },
		},
	})
	.parseInput(async ({ values }) => {
		let name = typeof values.name === "string" ? values.name : undefined;
		let vibe = typeof values.vibe === "string" ? values.vibe : undefined;
		let userName =
			typeof values["user-name"] === "string"
				? values["user-name"]
				: undefined;

		const nonInteractive = Boolean(values["non-interactive"]);
		if (!nonInteractive) {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			console.log("\n✨ Initializing NOOA Agentic Soul...");

			if (!name) {
				name =
					(await rl.question(
						"What should I be called? (default: NOOA): ",
					)) || "NOOA";
			}
			if (!vibe) {
				vibe =
					(await rl.question(
						"What is my vibe? (snarky, protocol, resourceful) (default: resourceful): ",
					)) || "resourceful";
			}
			if (!userName) {
				userName =
					(await rl.question(
						"And what should I call you? (default: Developer): ",
					)) || "Developer";
			}

			rl.close();
		}

		return {
			name,
			vibe,
			userName,
			root: typeof values.root === "string" ? values.root : undefined,
			force: Boolean(values.force),
			dryRun: Boolean(values["dry-run"]),
			nonInteractive,
			out: typeof values.out === "string" ? values.out : undefined,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess(async (output, values) => {
		if (values.json) {
			const payload = {
				schemaVersion: "1.0",
				ok: true,
				traceId: output.traceId,
				command: "init",
				timestamp: new Date().toISOString(),
				files: output.results,
				dryRun: output.dryRun,
			};
			await renderJsonOrWrite(
				payload,
				typeof values.out === "string" ? values.out : undefined,
			);
			return;
		}

		console.log(`\n✅ Init success (${output.traceId})`);
		console.log(`Initialized agent: ${output.name} (${output.vibe})`);
		output.results.forEach((file) => {
			console.log(`  - ${file}`);
		});
	})
	.onFailure((error) => {
		handleCommandError(error, ["init.already_exists"]);
	})
	.telemetry({
		eventPrefix: "init",
		successMetadata: (_, output) => ({
			traceId: output.traceId,
			dryRun: output.dryRun,
		}),
		failureMetadata: (_, error) => ({ error: error.message }),
	});

export const initAgentDoc = initBuilder.buildAgentDoc(false);
export const initFeatureDoc = (includeChangelog: boolean) =>
	initBuilder.buildFeatureDoc(includeChangelog);

const initCommand = initBuilder.build();

export default initCommand;
