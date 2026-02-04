import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { initIdentity } from "./init";

export const initMeta: AgentDocMeta = {
	name: "init",
	description: "Initialize agent identity artifacts",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const initHelp = `
Usage: nooa init [flags]

Initialize NOOA identity artifacts (Identity, Soul, User) in .nooa/ directory.

Flags:
  -h, --help    Show help message
  --force       Overwrite existing files (not implemented yet, safe default)

Exit Codes:
  0: Success
  1: Runtime Error

Error Codes:
  init.runtime_error: Init failed
`;

export const initSdkUsage = `
SDK Usage:
  const result = await init.run({ force: false });
  if (result.ok) console.log(result.data.message);
`;

export const initUsage = {
	cli: "nooa init [flags]",
	sdk: "await init.run({ force: false })",
	tui: "InitConsole()",
};

export const initSchema = {
	force: { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const initOutputFields = [
	{ name: "message", type: "string" },
];

export const initErrors = [
	{ code: "init.runtime_error", message: "Init failed." },
];

export const initExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
];

export const initExamples = [
	{ input: "nooa init", output: "Identity initialized" },
	{ input: "nooa init --force", output: "Overwrite identity" },
];

export interface InitRunInput {
	force?: boolean;
	json?: boolean;
}

export interface InitRunResult {
	message: string;
}

export async function run(
	input: InitRunInput,
): Promise<SdkResult<InitRunResult>> {
	try {
		await initIdentity(process.cwd());
		return {
			ok: true,
			data: {
				message: "NOOA Identity initialized in .nooa/",
			},
		};
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : JSON.stringify(error);
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
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ values }) => ({
		force: Boolean(values.force),
		json: Boolean(values.json),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({ ok: true, message: output.message });
			return;
		}
		console.log("\n✅ NOOA Identity initialized in .nooa/");
		console.log("- IDENTITY.md: Who I am");
		console.log("- SOUL.md: My directives");
		console.log("- USER.md: Who you are");
	})
	.onFailure((error) => {
		console.error(`❌ Init failed: ${error.message}`);
		handleCommandError(error, []);
	})
	.telemetry({
		eventPrefix: "init",
		successMetadata: () => ({}),
		failureMetadata: (_, error) => ({ error: error.message }),
	});

export const initAgentDoc = initBuilder.buildAgentDoc(false);
export const initFeatureDoc = (includeChangelog: boolean) =>
	initBuilder.buildFeatureDoc(includeChangelog);

const initCommand = initBuilder.build();

export default initCommand;
