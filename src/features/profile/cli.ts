import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { run as runProfile } from "./execute";

export type ProfileAction = "inspect" | "help";

export const profileMeta: AgentDocMeta = {
	name: "profile",
	description: "Capture agent-first CPU hotspot summaries for commands",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const profileHelp = `
Usage: nooa profile <subcommand> [flags] -- <command...>

Capture agent-first performance snapshots for a target command.

Subcommands:
  inspect              Run a command with CPU profiling enabled and summarize hotspots.

Flags:
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa profile inspect -- node script.js
  nooa profile inspect --json -- bun run src/app.ts

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  profile.invalid_action: Subcommand is required.
  profile.invalid_target: Unsupported or missing runtime command.
  profile.runtime_error: Profiling failed.
`;

export const profileSdkUsage = `
SDK Usage:
  const result = await profile.run({ action: "inspect", command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.hotspots[0]);
`;

export const profileUsage = {
	cli: "nooa profile <subcommand> [flags] -- <command...>",
	sdk: 'await profile.run({ action: "inspect", command: ["node", "script.js"] })',
	tui: "ProfileConsole()",
};

export const profileSchema = {
	action: { type: "string", required: true },
	command: { type: "string", required: true },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const profileOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "traceId", type: "string" },
	{ name: "runtime", type: "string" },
	{ name: "exit_code", type: "number" },
	{ name: "duration_ms", type: "number" },
	{ name: "profile_path", type: "string" },
	{ name: "total_samples", type: "number" },
	{ name: "total_profiled_ms", type: "number" },
	{ name: "investigation", type: "string" },
	{ name: "hotspots", type: "string" },
];

export const profileErrors = [
	{ code: "profile.invalid_action", message: "Subcommand is required." },
	{
		code: "profile.invalid_target",
		message: "Unsupported or missing runtime command.",
	},
	{ code: "profile.runtime_error", message: "Profiling failed." },
];

export const profileExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const profileExamples = [
	{
		input: "nooa profile inspect -- node script.js",
		output: "Profile a Node script and summarize hotspots.",
	},
	{
		input: "nooa profile inspect --json -- bun run src/app.ts",
		output: "Return a structured hotspot summary for an agent.",
	},
];

export interface ProfileCliRunInput {
	action?: ProfileAction;
	command?: string[];
	json?: boolean;
}

export interface ProfileCliRunResult {
	mode: string;
	traceId: string;
	runtime: string;
	command: string[];
	exit_code: number;
	duration_ms: number;
	profile_path: string;
	total_samples: number;
	total_profiled_ms: number;
	hotspots: Array<{
		function: string;
		url: string;
		line: number;
		column: number;
		self_ms: number;
		samples: number;
	}>;
	stdout: string;
	stderr: string;
}

export async function run(
	input: ProfileCliRunInput,
): Promise<SdkResult<ProfileCliRunResult>> {
	if (!input.action || input.action === "help") {
		return {
			ok: false,
			error: sdkError("profile.invalid_action", "Subcommand is required."),
		};
	}

	const result = await runProfile({
		action: "inspect",
		command: input.command,
	});

	if (!result.ok) {
		return {
			ok: false,
			error: sdkError(result.error.code, result.error.message),
		};
	}

	return { ok: true, data: result.data };
}

const profileBuilder = new CommandBuilder<
	ProfileCliRunInput,
	ProfileCliRunResult
>()
	.meta(profileMeta)
	.usage(profileUsage)
	.schema(profileSchema)
	.help(profileHelp)
	.sdkUsage(profileSdkUsage)
	.outputFields(profileOutputFields)
	.examples(profileExamples)
	.errors(profileErrors)
	.exitCodes(profileExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values, rawArgs }) => {
		const sourceArgs = rawArgs ?? positionals;
		const delimiterIndex = sourceArgs.indexOf("--");
		const command =
			delimiterIndex >= 0 ? sourceArgs.slice(delimiterIndex + 1) : [];
		return {
			action: (positionals[1] as ProfileAction | undefined) ?? undefined,
			command,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({
				schemaVersion: "1.0",
				command: "profile",
				mode: output.mode,
				traceId: output.traceId,
				runtime: output.runtime,
				exit_code: output.exit_code,
				duration_ms: output.duration_ms,
				profile_path: output.profile_path,
				total_samples: output.total_samples,
				total_profiled_ms: output.total_profiled_ms,
				investigation: {
					kind: "profile_hotspots",
					runtime: output.runtime,
					duration_ms: output.duration_ms,
					hotspots: output.hotspots,
				},
				hotspots: output.hotspots,
				stdout: output.stdout,
				stderr: output.stderr,
			});
			return;
		}

		console.log(`Runtime: ${output.runtime}`);
		console.log(`Exit code: ${output.exit_code}`);
		console.log(`Duration: ${output.duration_ms}ms`);
		console.log(`Profile: ${output.profile_path}`);
		console.log("");
		console.log("Top hotspots:");
		for (const hotspot of output.hotspots.slice(0, 5)) {
			console.log(
				`- ${hotspot.function} (${hotspot.self_ms}ms, ${hotspot.samples} samples) ${hotspot.url}:${hotspot.line}`,
			);
		}
	})
	.onFailure((error) => {
		if (error.code === "profile.invalid_action") {
			console.log(profileHelp);
			process.exitCode = 2;
			return;
		}
		if (error.code === "profile.invalid_target") {
			console.error(error.message);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, [
			"profile.invalid_action",
			"profile.invalid_target",
		]);
	})
	.telemetry({
		eventPrefix: "profile",
		successMetadata: (_, output) => ({
			runtime: output.runtime,
			exit_code: output.exit_code,
			duration_ms: output.duration_ms,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const profileAgentDoc = profileBuilder.buildAgentDoc(false);
export const profileFeatureDoc = (includeChangelog: boolean) =>
	profileBuilder.buildFeatureDoc(includeChangelog);

const profileCommand = profileBuilder.build();

export default profileCommand;
