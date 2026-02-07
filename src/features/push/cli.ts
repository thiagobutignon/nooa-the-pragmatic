import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson,
	setExitCode
} from "../../core/cli-output";

import { createTraceId, logger } from "../../core/logger";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { telemetry } from "../../core/telemetry";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { EventBus } from "../../core/event-bus";
import { ensureGitRepo, git, isWorkingTreeClean } from "./guards";

export const pushMeta: AgentDocMeta = {
	name: "push",
	description: "Push changes to remote repository",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const pushHelp = `
Usage: nooa push [remote] [branch] [flags]

Push committed changes to the remote repository.

Arguments:
  [remote]       Git remote name (default: origin).
  [branch]       Git branch name (default: current branch).

Flags:
  --no-test      Skip automatic test verification before pushing.
  --json         Output result as JSON.
  -h, --help     Show help message.

Examples:
  nooa push
  nooa push origin feat/auth --no-test

Exit Codes:
  0: Success
  1: Runtime Error (git push failed)
  2: Validation Error (not a git repo or dirty tree)
  3: Test Failure (pre-push tests failed)

Error Codes:
  push.not_git_repo: Not a git repository
  push.dirty_tree: Uncommitted changes detected
  push.policy_violation: Policy violations found
  push.tests_failed: Tests failed
  push.push_failed: Git push failed
`;

export const pushSdkUsage = `
SDK Usage:
  const result = await push.run({ remote: "origin", branch: "main" });
  if (result.ok) console.log(result.data.message);
`;

export const pushUsage = {
	cli: "nooa push [remote] [branch] [flags]",
	sdk: "await push.run({ remote: \"origin\", branch: \"main\" })",
	tui: "PushConsole()",
};

export const pushSchema = {
	remote: { type: "string", required: false },
	branch: { type: "string", required: false },
	"no-test": { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const pushOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "traceId", type: "string" },
	{ name: "message", type: "string" },
];

export const pushErrors = [
	{ code: "push.not_git_repo", message: "Not a git repository." },
	{ code: "push.dirty_tree", message: "Uncommitted changes detected." },
	{
		code: "push.policy_violation",
		message: "Policy violations found in the project.",
	},
	{ code: "push.tests_failed", message: "Tests failed." },
	{ code: "push.push_failed", message: "Git push failed." },
];

export const pushExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
	{ value: "3", description: "Test failure" },
];

export const pushExamples = [
	{ input: "nooa push", output: "Push committed changes to the remote repository." },
	{
		input: "nooa push origin feat/auth --no-test",
		output: "Push changes to 'origin/feat/auth' skipping pre-push tests.",
	},
];

export interface PushRunInput {
	remote?: string;
	branch?: string;
	noTest?: boolean;
	json?: boolean;
	bus?: EventBus;
}

export interface PushRunResult {
	ok: boolean;
	traceId: string;
	message: string;
}

export async function run(
	input: PushRunInput,
): Promise<SdkResult<PushRunResult>> {
	const traceId = createTraceId();
	const startTime = Date.now();
	logger.setContext({ trace_id: traceId, command: "push" });

	const cwd = process.env.NOOA_CWD ?? process.env.PWD ?? process.cwd();
	if (!(await ensureGitRepo(cwd))) {
		return {
			ok: false,
			error: sdkError("push.not_git_repo", "Not a git repository.", {
				traceId,
			}),
		};
	}

	if (!(await isWorkingTreeClean(cwd))) {
		return {
			ok: false,
			error: sdkError("push.dirty_tree", "Uncommitted changes detected.", {
				traceId,
			}),
		};
	}

	const engine = new PolicyEngine();
	const filesToCheck = await growFileList(cwd);
	const policyResult = await engine.checkFiles(filesToCheck);
	if (!policyResult.ok) {
		return {
			ok: false,
			error: sdkError(
				"push.policy_violation",
				"Policy violations found in the project.",
				{ traceId, violations: policyResult.violations },
			),
		};
	}

	telemetry.track(
		{
			event: "push.started",
			level: "info",
			success: true,
			trace_id: traceId,
		},
		input.bus,
	);

	if (!input.noTest) {
		const testResult = await execa("bun", ["test"], { cwd, reject: false });
		if (testResult.exitCode !== 0) {
			return {
				ok: false,
				error: sdkError("push.tests_failed", "Tests failed.", {
					traceId,
				}),
			};
		}
	}

	const args = [
		"push",
		...(input.remote ? [input.remote] : []),
		...(input.branch ? [input.branch] : []),
	];
	const pushResult = await git(args, cwd);
	if (pushResult.exitCode !== 0) {
		telemetry.track(
			{
				event: "push.failure",
				level: "error",
				success: false,
				duration_ms: Date.now() - startTime,
				trace_id: traceId,
				metadata: {
					error_message: pushResult.stderr?.trim() ?? "push failed",
				},
			},
			input.bus,
		);
		return {
			ok: false,
			error: sdkError("push.push_failed", "Git push failed.", {
				traceId,
				stderr: pushResult.stderr,
			}),
		};
	}

	telemetry.track(
		{
			event: "push.success",
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
			ok: true,
			traceId,
			message: "Push successful",
		},
	};
}

const pushBuilder = new CommandBuilder<PushRunInput, PushRunResult>()
	.meta(pushMeta)
	.usage(pushUsage)
	.schema(pushSchema)
	.help(pushHelp)
	.sdkUsage(pushSdkUsage)
	.outputFields(pushOutputFields)
	.examples(pushExamples)
	.errors(pushErrors)
	.exitCodes(pushExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			"no-test": { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values, bus }) => ({
		remote: positionals[1],
		branch: positionals[2],
		noTest: Boolean(values["no-test"]),
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
		if (input.json) {
			if (error.code === "push.policy_violation") {
				renderJson({
					ok: false,
					violations: error.details?.violations ?? [],
				});
				setExitCode(error, [
					"push.not_git_repo",
					"push.dirty_tree",
					"push.policy_violation",
				]);
				return;
			}
			renderJson({
				ok: false,
				traceId: error.details?.traceId,
				error: error.message,
			});
			if (error.code === "push.tests_failed") {
				process.exitCode = 3;
				return;
			}
			setExitCode(error, [
				"push.not_git_repo",
				"push.dirty_tree",
				"push.policy_violation",
			]);
			return;
		}
		if (error.code === "push.tests_failed") {
			console.error("Error: Tests failed.");
			process.exitCode = 3;
			return;
		}
		if (error.code === "push.policy_violation") {
			console.error(
				`\n❌ Error: Policy violations found in the project (${(error.details?.violations as unknown[] | undefined)?.length ?? 0}). Push blocked.`,
			);
			const violations = error.details?.violations as
				| { rule: string; file: string; line: number; content: string }[]
				| undefined;
			if (violations) {
				for (const v of violations) {
					console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
				}
			}
			setExitCode(error, [
				"push.not_git_repo",
				"push.dirty_tree",
				"push.policy_violation",
			]);
			return;
		}
		if (error.code === "push.not_git_repo") {
			console.error("Error: Not a git repository.");
			process.exitCode = 2;
			return;
		}
		if (error.code === "push.dirty_tree") {
			console.error("Error: Uncommitted changes detected.");
			process.exitCode = 2;
			return;
		}
		if (error.code === "push.push_failed") {
			console.error(error.details?.stderr || "Error: Git push failed.");
			process.exitCode = 1;
			return;
		}
		handleCommandError(error, [
			"push.not_git_repo",
			"push.dirty_tree",
			"push.policy_violation",
		]);
	})
	.telemetry({
		eventPrefix: "push",
		successMetadata: (_, output) => ({
			message: output.message,
		}),
		failureMetadata: (_, error) => ({
			error: error.message,
		}),
	});

export const pushAgentDoc = pushBuilder.buildAgentDoc(false);
export const pushFeatureDoc = (includeChangelog: boolean) =>
	pushBuilder.buildFeatureDoc(includeChangelog);

const pushCommand = pushBuilder.build();

async function growFileList(path: string): Promise<string[]> {
	try {
		const stat = await lstat(path);
		if (stat.isFile()) return [path];

		const files: string[] = [];
		const entries = await readdir(path, { withFileTypes: true });

		for (const entry of entries) {
			const full = join(path, entry.name);
			if (
				entry.name === ".git" ||
				entry.name === "node_modules" ||
				entry.name === "memory"
			)
				continue;
			if (entry.isDirectory()) {
				files.push(...(await growFileList(full)));
			} else {
				files.push(full);
			}
		}
		return files;
	} catch {
		return [];
	}
}

export default pushCommand;
