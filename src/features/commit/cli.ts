import { execa } from "execa";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import { createTraceId, logger } from "../../core/logger";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { telemetry } from "../../core/telemetry";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { EventBus } from "../../core/event-bus";
import {
	ensureGitRepo,
	git,
	hasPendingChanges,
	hasStagedChanges,
} from "./guards";

export const commitMeta: AgentDocMeta = {
	name: "commit",
	description: "Commit staged changes with validation",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const commitHelp = `
Usage: nooa commit -m <message> [flags]

Commit staged changes with validation (TDD, no forbidden markers).

Flags:
  -m <message>   Commit message (required).
  --no-test      Skip automatic test verification.
  --allow-lazy   Allow TODO/MOCK markers in the code. // nooa-ignore
  -h, --help     Show help message.

Examples:
  nooa commit -m "feat: user authentication"
  nooa commit -m "docs: api reference" --allow-lazy // nooa-ignore

Exit Codes:
  0: Success
  1: Runtime Error (git failure or tests failed)
  2: Validation Error (missing message or local guards failed)

Error Codes:
  commit.missing_message: Commit message is required
  commit.not_git_repo: Not a git repository
  commit.no_changes: No changes to commit
  commit.no_staged: No staged changes
  commit.policy_violation: Zero-Preguiça violations found
  commit.tests_failed: Tests failed
  commit.git_failed: Git commit failed
`;

export const commitSdkUsage = `
SDK Usage:
  const result = await commit.run({ message: "feat: x", allowLazy: true });
  if (result.ok) console.log(result.data.message);
`;

export const commitUsage = {
	cli: "nooa commit -m <message> [flags]",
	sdk: "await commit.run({ message: \"feat: x\" })",
	tui: "CommitConsole()",
};

export const commitSchema = {
	message: { type: "string", required: true },
	"no-test": { type: "boolean", required: false },
	"allow-lazy": { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const commitOutputFields = [
	{ name: "traceId", type: "string" },
	{ name: "message", type: "string" },
];

export const commitErrors = [
	{ code: "commit.missing_message", message: "Commit message is required." },
	{ code: "commit.not_git_repo", message: "Not a git repository." },
	{ code: "commit.no_changes", message: "No changes to commit." },
	{ code: "commit.no_staged", message: "No staged changes." },
	{
		code: "commit.policy_violation",
		message: "Zero-Preguiça violations found.",
	},
	{ code: "commit.tests_failed", message: "Tests failed." },
	{ code: "commit.git_failed", message: "Git commit failed." },
];

export const commitExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const commitExamples = [
	{ input: "nooa commit -m \"feat: user authentication\"", output: "Commit" },
	{
		input: "nooa commit -m \"docs: api reference\" --allow-lazy",
		output: "Commit with allow-lazy",
	},
];

export interface CommitRunInput {
	message?: string;
	noTest?: boolean;
	allowLazy?: boolean;
	json?: boolean;
	bus?: EventBus;
}

export interface CommitRunResult {
	traceId: string;
	message: string;
}

export async function run(
	input: CommitRunInput,
): Promise<SdkResult<CommitRunResult>> {
	const traceId = logger.getContext().trace_id || createTraceId();
	const startTime = Date.now();
	logger.setContext({ trace_id: traceId, command: "commit" });

	if (!input.message) {
		return {
			ok: false,
			error: sdkError(
				"commit.missing_message",
				"Commit message is required. Use -m <message>.",
			),
		};
	}

	const cwd = process.cwd();
	if (!(await ensureGitRepo(cwd))) {
		return {
			ok: false,
			error: sdkError("commit.not_git_repo", "Not a git repository."),
		};
	}

	if (!(await hasPendingChanges(cwd))) {
		return {
			ok: false,
			error: sdkError("commit.no_changes", "No changes to commit."),
		};
	}

	if (!(await hasStagedChanges(cwd))) {
		return {
			ok: false,
			error: sdkError("commit.no_staged", "No staged changes."),
		};
	}

	if (!input.allowLazy) {
		const engine = new PolicyEngine();
		const { stdout } = await execa("git", [
			"diff",
			"--cached",
			"--name-only",
			"--diff-filter=ACMR",
		]);
		const filesToCheck = stdout.split("\n").filter((f) => f.trim() !== "");

		const result = await engine.checkFiles(filesToCheck);
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("commit.policy_violation", "Zero-Preguiça violation", {
					violations: result.violations,
				}),
			};
		}
	}

	telemetry.track(
		{
			event: "commit.started",
			level: "info",
			success: true,
			trace_id: traceId,
			metadata: { allow_todo: Boolean(input.allowLazy) }, // nooa-ignore
		},
		input.bus,
	);

	if (!input.noTest) {
		console.log("Running tests...");
		const testResult = await execa("bun", ["test"], {
			cwd,
			reject: false,
			stdio: "inherit",
		});
		if (testResult.exitCode !== 0) {
			return {
				ok: false,
				error: sdkError("commit.tests_failed", "Tests failed."),
			};
		}
	}

	const commitResult = await git(["commit", "-m", String(input.message)], cwd);
	if (commitResult.exitCode !== 0) {
		telemetry.track(
			{
				event: "commit.failure",
				level: "error",
				success: false,
				duration_ms: Date.now() - startTime,
				trace_id: traceId,
				metadata: {
					error_message: commitResult.stderr?.trim() ?? "commit failed",
				},
			},
			input.bus,
		);
		return {
			ok: false,
			error: sdkError("commit.git_failed", "Git commit failed.", {
				stderr: commitResult.stderr,
			}),
		};
	}

	telemetry.track(
		{
			event: "commit.success",
			level: "info",
			success: true,
			duration_ms: Date.now() - startTime,
			trace_id: traceId,
		},
		input.bus,
	);

	return {
		ok: true,
		data: {
			traceId,
			message: "Commit successful",
		},
	};
}

const commitBuilder = new CommandBuilder<CommitRunInput, CommitRunResult>()
	.meta(commitMeta)
	.usage(commitUsage)
	.schema(commitSchema)
	.help(commitHelp)
	.sdkUsage(commitSdkUsage)
	.outputFields(commitOutputFields)
	.examples(commitExamples)
	.errors(commitErrors)
	.exitCodes(commitExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			m: { type: "string", short: "m" },
			"no-test": { type: "boolean" },
			"allow-lazy": { type: "boolean" },
		},
	})
	.parseInput(async ({ values, bus }) => ({
		message: typeof values.m === "string" ? values.m : undefined,
		noTest: Boolean(values["no-test"]),
		allowLazy: Boolean(values["allow-lazy"]),
		json: Boolean(values.json),
		bus,
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({ ok: true, traceId: output.traceId, message: output.message });
			return;
		}
		console.log(`✅ ${output.message} [${output.traceId}]`);
	})
	.onFailure((error, input) => {
		if (error.code === "commit.missing_message") {
			console.error("Error: Commit message is required. Use -m <message>.");
			process.exitCode = 2;
			return;
		}
		if (error.code === "commit.not_git_repo") {
			console.error("Error: Not a git repository.");
			process.exitCode = 2;
			return;
		}
		if (error.code === "commit.no_changes") {
			console.error("Error: No changes to commit.");
			process.exitCode = 2;
			return;
		}
		if (error.code === "commit.no_staged") {
			const msg = "Error: No staged changes.";
			if (input.json) renderJson({ ok: false, error: msg });
			else console.error(msg);
			process.exitCode = 2;
			return;
		}
		if (error.code === "commit.policy_violation") {
			const violations = error.details?.violations as
				| { rule: string; file: string; line: number; content: string }[]
				| undefined;
			if (input.json) {
				renderJson({ ok: false, violations: violations ?? [] });
			} else {
				console.error("\n❌ Error: Zero-Preguiça violation found:");
				if (violations) {
					for (const v of violations) {
						console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
					}
				}
				console.error(
					"\nFix these violations or use --allow-lazy to override.",
				);
			}
			process.exitCode = 2;
			return;
		}
		if (error.code === "commit.tests_failed") {
			console.error("Error: Tests failed.");
			process.exitCode = 1;
			return;
		}
		if (error.code === "commit.git_failed") {
			console.error(error.details?.stderr || "Error: Git commit failed.");
			process.exitCode = 1;
			return;
		}
		handleCommandError(error, [
			"commit.missing_message",
			"commit.not_git_repo",
			"commit.no_changes",
			"commit.no_staged",
			"commit.policy_violation",
		]);
	})
	.telemetry({
		eventPrefix: "commit",
		successMetadata: (input) => ({
			allow_lazy: Boolean(input.allowLazy),
		}),
		failureMetadata: (_, error) => ({
			error: error.message,
		}),
	});

export const commitAgentDoc = commitBuilder.buildAgentDoc(false);
export const commitFeatureDoc = (includeChangelog: boolean) =>
	commitBuilder.buildFeatureDoc(includeChangelog);

const commitCommand = commitBuilder.build();

export default commitCommand;
