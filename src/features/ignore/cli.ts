import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import {
	addPattern,
	checkPathIgnored,
	loadIgnore,
	matchesPattern,
	removePattern,
} from "./execute";

export const ignoreMeta: AgentDocMeta = {
	name: "ignore",
	description: "Manage .nooa-ignore patterns",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const ignoreHelp = `
Usage: nooa ignore <command> [pattern] [paths...] [flags]

Manage .nooa-ignore patterns for policy audits.

Commands:
  add <pattern>        Add a new pattern to the ignore list.
  remove <pattern>     Remove a pattern from the ignore list.
  list                 Display all current ignore patterns.
  check <path>         Check whether <path> is ignored by the current list.
  test <pattern> [path...]
                       Test a pattern locally against sample paths.

Flags:
  --json               Output results as JSON.
  -h, --help           Show help message.

Examples:
  nooa ignore add secret.ts
  nooa ignore list
  nooa ignore check logs/app.log
  nooa ignore test "logs/*.log" logs/app.log README.md

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  ignore.missing_command: Subcommand required
  ignore.missing_pattern: Pattern required
  ignore.missing_path: Path required
  ignore.unknown_command: Unknown subcommand
  ignore.runtime_error: Unexpected error
`;

export const ignoreSdkUsage = `
SDK Usage:
  await ignore.run({ action: "add", pattern: "secret.ts" });
  const result = await ignore.run({ action: "list" });
`;

export const ignoreUsage = {
	cli: "nooa ignore <command> [pattern] [paths...] [flags]",
	sdk: "await ignore.run({ action: \"list\" })",
	tui: "IgnoreConsole()",
};

export const ignoreSchema = {
	action: { type: "string", required: true },
	pattern: { type: "string", required: false },
	paths: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const ignoreOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "pattern", type: "string" },
	{ name: "patterns", type: "string" },
	{ name: "result", type: "string" },
];

export const ignoreErrors = [
	{ code: "ignore.missing_command", message: "Subcommand required." },
	{ code: "ignore.missing_pattern", message: "Pattern required." },
	{ code: "ignore.missing_path", message: "Path required." },
	{ code: "ignore.unknown_command", message: "Unknown subcommand." },
	{ code: "ignore.runtime_error", message: "Unexpected error." },
];

export const ignoreExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const ignoreExamples = [
	{ input: "nooa ignore add secret.ts", output: "Add pattern" },
	{ input: "nooa ignore list", output: "List patterns" },
];

export interface IgnoreRunInput {
	action?: string;
	pattern?: string;
	paths?: string[];
	json?: boolean;
}

export interface IgnoreRunResult {
	mode: string;
	pattern?: string;
	patterns?: string[];
	result?: unknown;
}

export async function run(
	input: IgnoreRunInput,
): Promise<SdkResult<IgnoreRunResult>> {
	const action = input.action;
	if (!action) {
		return {
			ok: false,
			error: sdkError("ignore.missing_command", "Subcommand required."),
		};
	}

	try {
		if (action === "add") {
			const pattern = input.pattern;
			if (!pattern) {
				return {
					ok: false,
					error: sdkError("ignore.missing_pattern", "Pattern required."),
				};
			}
			const added = await addPattern(pattern);
			return {
				ok: true,
				data: {
					mode: "add",
					pattern,
					result: added,
				},
			};
		}

		if (action === "remove") {
			const pattern = input.pattern;
			if (!pattern) {
				return {
					ok: false,
					error: sdkError("ignore.missing_pattern", "Pattern required."),
				};
			}
			const removed = await removePattern(pattern);
			return {
				ok: true,
				data: {
					mode: "remove",
					pattern,
					result: removed,
				},
			};
		}

		if (action === "list") {
			const patterns = await loadIgnore();
			return {
				ok: true,
				data: { mode: "list", patterns },
			};
		}

		if (action === "check") {
			const target = input.pattern;
			if (!target) {
				return {
					ok: false,
					error: sdkError("ignore.missing_path", "Path required."),
				};
			}
			const result = await checkPathIgnored(target);
			return {
				ok: true,
				data: {
					mode: "check",
					pattern: target,
					result,
				},
			};
		}

		if (action === "test") {
			const pattern = input.pattern;
			if (!pattern) {
				return {
					ok: false,
					error: sdkError("ignore.missing_pattern", "Pattern required."),
				};
			}
			const samplePaths = input.paths && input.paths.length ? input.paths : ["."];
			const results = samplePaths.map((sample) => ({
				path: sample,
				matches: matchesPattern(pattern, sample),
			}));
			const matched = results.some((item) => item.matches);
			return {
				ok: true,
				data: {
					mode: "test",
					pattern,
					result: { matched, results },
				},
			};
		}

		return {
			ok: false,
			error: sdkError("ignore.unknown_command", "Unknown subcommand."),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("ignore.runtime_error", message),
		};
	}
}

const ignoreBuilder = new CommandBuilder<IgnoreRunInput, IgnoreRunResult>()
	.meta(ignoreMeta)
	.usage(ignoreUsage)
	.schema(ignoreSchema)
	.help(ignoreHelp)
	.sdkUsage(ignoreSdkUsage)
	.outputFields(ignoreOutputFields)
	.examples(ignoreExamples)
	.errors(ignoreErrors)
	.exitCodes(ignoreExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values }) => {
		const cmdIndex = positionals.indexOf("ignore");
		const action = positionals[cmdIndex + 1];
		const args = positionals.slice(cmdIndex + 2);
		return {
			action,
			pattern: args[0],
			paths: args.slice(1),
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({ ok: true, ...output });
			return;
		}

		switch (output.mode) {
			case "add": {
				const changed = output.result as boolean;
				console.log(
					changed
						? `✅ Pattern '${output.pattern}' added.`
						: `ℹ️ Pattern '${output.pattern}' already exists.`,
				);
				return;
			}
			case "remove": {
				const changed = output.result as boolean;
				console.log(
					changed
						? `✅ Pattern '${output.pattern}' removed.`
						: `ℹ️ Pattern '${output.pattern}' not found.`,
				);
				return;
			}
			case "list": {
				const patterns = output.patterns ?? [];
				if (patterns.length === 0) {
					console.log("ℹ️ No patterns found in .nooa-ignore.");
					return;
				}
				console.log("Current ignore patterns:");
				for (const p of patterns) console.log(`  - ${p}`);
				return;
			}
			case "check": {
				const result = output.result as { ignored: boolean; pattern?: string };
				if (result.ignored) {
					console.log(`✅ ${output.pattern} is ignored by ${result.pattern}`);
					process.exitCode = 0;
					return;
				}
				console.log(`❌ ${output.pattern} is not ignored by any pattern.`);
				process.exitCode = 1;
				return;
			}
			case "test": {
				const payload = output.result as {
					matched: boolean;
					results: { path: string; matches: boolean }[];
				};
				console.log(`Testing pattern: ${output.pattern}`);
				for (const result of payload.results) {
					console.log(`${result.matches ? "✅" : "❌"} ${result.path}`);
				}
				if (!payload.matched) {
					console.log(`No matches for pattern '${output.pattern}'.`);
				}
				process.exitCode = payload.matched ? 0 : 2;
				return;
			}
			default:
				break;
		}
	})
	.onFailure((error) => {
		if (error.code === "ignore.missing_command") {
			console.error("Error: Unknown subcommand.");
			console.log(ignoreHelp);
			process.exitCode = 2;
			return;
		}
		if (
			error.code === "ignore.missing_pattern" ||
			error.code === "ignore.missing_path" ||
			error.code === "ignore.unknown_command"
		) {
			console.error(error.message);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, [
			"ignore.missing_command",
			"ignore.missing_pattern",
			"ignore.missing_path",
			"ignore.unknown_command",
		]);
	})
	.telemetry({
		eventPrefix: "ignore",
		successMetadata: (input, output) => ({
			action: output.mode,
			pattern: input.pattern,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const ignoreAgentDoc = ignoreBuilder.buildAgentDoc(false);
export const ignoreFeatureDoc = (includeChangelog: boolean) =>
	ignoreBuilder.buildFeatureDoc(includeChangelog);

const ignoreCommand = ignoreBuilder.build();

export default ignoreCommand;
