import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { EventBus } from "../../core/event-bus";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { runFix } from "./execute";

export const fixMeta: AgentDocMeta = {
	name: "fix",
	description: "Autonomous bug fix loop",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const fixHelp = `
Usage: nooa fix <issue> [flags]

Autonomous agent loop: worktree → context → patch → verify → commit.

Arguments:
  <issue>        A description or ID of the bug/feature to fix.

Flags:
  --dry-run      Analyze but do not perform changes.
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa fix "fix logger typo"
  nooa fix "implement new auth flow" --dry-run

Exit Codes:
  0: Success
  1: Runtime Error (fix failed)
  2: Validation Error (missing issue)

Error Codes:
  fix.missing_issue: Issue description required
  fix.runtime_error: Fix failed
`;

export const fixSdkUsage = `
SDK Usage:
  const result = await fix.run({ issue: "fix logger typo", dryRun: true });
  if (result.ok) console.log(result.data.traceId);
`;

export const fixUsage = {
	cli: "nooa fix <issue> [flags]",
	sdk: 'await fix.run({ issue: "fix logger typo" })',
	tui: "FixConsole()",
};

export const fixSchema = {
	issue: { type: "string", required: true },
	"dry-run": { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const fixOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "traceId", type: "string" },
	{ name: "stages", type: "string" },
	{ name: "error", type: "string" },
];

export const fixErrors = [
	{ code: "fix.missing_issue", message: "Issue description required." },
	{ code: "fix.runtime_error", message: "Fix failed." },
];

export const fixExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const fixExamples = [
	{
		input: 'nooa fix "fix logger typo"',
		output: "Start autonomous agent loop to fix 'logger typo'.",
	},
	{
		input: 'nooa fix "auth flow" --dry-run',
		output: "Simulate a fix for 'auth flow' without making changes.",
	},
];

export interface FixRunInput {
	issue?: string;
	dryRun?: boolean;
	json?: boolean;
	bus?: EventBus;
	traceId?: string;
}

export interface FixRunResult {
	ok: boolean;
	traceId: string;
	stages: {
		worktree: boolean;
		context: boolean;
		patch: boolean;
		verify: boolean;
		commit: boolean;
	};
	error?: string;
}

export async function run(
	input: FixRunInput,
): Promise<SdkResult<FixRunResult>> {
	if (!input.issue) {
		return {
			ok: false,
			error: sdkError("fix.missing_issue", "Issue description required."),
		};
	}

	try {
		const result = await runFix({ issue: input.issue, dryRun: input.dryRun });
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("fix.runtime_error", result.error || "Fix failed."),
			};
		}
		return { ok: true, data: result };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("fix.runtime_error", message),
		};
	}
}

const fixBuilder = new CommandBuilder<FixRunInput, FixRunResult>()
	.meta(fixMeta)
	.usage(fixUsage)
	.schema(fixSchema)
	.help(fixHelp)
	.sdkUsage(fixSdkUsage)
	.outputFields(fixOutputFields)
	.examples(fixExamples)
	.errors(fixErrors)
	.exitCodes(fixExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			"dry-run": { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values, bus, traceId }) => {
		const issue = positionals[1];
		if (bus && traceId) {
			bus.emit("fix.started", {
				type: "fix.started",
				traceId,
				issue: issue ?? "",
			});
		}
		return {
			issue,
			dryRun: Boolean(values["dry-run"]),
			json: Boolean(values.json),
			bus,
			traceId,
		};
	})
	.run(run)
	.onSuccess((output, values, input) => {
		if (values.json) {
			renderJson(output);
			process.exitCode = output.ok ? 0 : 1;
			input.bus?.emit("fix.completed", {
				type: "fix.completed",
				traceId: input.traceId ?? output.traceId,
				issue: input.issue ?? "",
				ok: output.ok,
			});
			return;
		}

		console.log(
			`🔧 Starting autonomous fix for: "${values.issue ?? output.traceId}"...\n`,
		);
		console.log(
			output.stages.worktree ? "✅ Worktree created" : "❌ Worktree failed",
		);
		console.log(
			output.stages.context
				? "✅ Context built (Semantic)"
				: "❌ Context failed",
		);
		console.log(output.stages.patch ? "✅ Patch applied" : "❌ Patch failed");
		console.log(
			output.stages.verify
				? "✅ Verification (CI) passed"
				: "❌ Verification failed",
		);
		console.log(
			output.stages.commit ? "✅ Changes committed" : "❌ Commit skipped",
		);

		if (output.ok) {
			console.log(`\n🎉 Fix complete! [Trace ID: ${output.traceId}]`);
		} else {
			console.error(`\n❌ Fix failed: ${output.error || "unknown error"}`);
		}
		process.exitCode = output.ok ? 0 : 1;
		input.bus?.emit("fix.completed", {
			type: "fix.completed",
			traceId: input.traceId ?? output.traceId,
			issue: input.issue ?? "",
			ok: output.ok,
		});
	})
	.onFailure((error, input) => {
		input.bus?.emit("fix.failed", {
			type: "fix.failed",
			traceId: input.traceId ?? "",
			issue: input.issue ?? "",
			error: error.message,
		});
		if (error.code === "fix.missing_issue") {
			console.error("Error: Issue description required.");
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["fix.missing_issue"]);
	})
	.telemetry({
		eventPrefix: "fix",
		successMetadata: (input, output) => ({
			issue: input.issue,
			ok: output.ok,
		}),
		failureMetadata: (input, error) => ({
			issue: input.issue,
			error: error.message,
		}),
	});

export const fixAgentDoc = fixBuilder.buildAgentDoc(false);
export const fixFeatureDoc = (includeChangelog: boolean) =>
	fixBuilder.buildFeatureDoc(includeChangelog);

const fixCommand = fixBuilder.build();

export default fixCommand;
