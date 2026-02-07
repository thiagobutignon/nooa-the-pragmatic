import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson,
	setExitCode,
} from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { EventBus } from "../../core/event-bus";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import {
	createWorktree,
	listWorktrees,
	lockWorktree,
	pruneWorktrees,
	removeWorktree,
	WorktreeError,
	worktreeInfo,
} from "./execute";

export type WorktreeAction =
	| "create"
	| "list"
	| "remove"
	| "prune"
	| "lock"
	| "unlock"
	| "info"
	| "help";

const ACTIONS: WorktreeAction[] = [
	"create",
	"list",
	"remove",
	"prune",
	"lock",
	"unlock",
	"info",
];

export const worktreeMeta: AgentDocMeta = {
	name: "worktree",
	description: "Manage git worktrees for isolated development",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const worktreeHelp = `
Usage: nooa worktree <subcommand> [args] [flags]

Manage git worktrees for isolated development.

Subcommands:
  create <branch>    Create a new worktree (default when no subcommand provided).
  list               List existing worktrees under .worktrees/.
  remove <branch>    Remove a managed worktree.
  prune              Clean up stale worktrees.
  lock <branch>      Lock a worktree before force pushes.
  unlock <branch>    Unlock a previously locked worktree.
  info <branch>      Show metadata for a managed worktree (JSON output available).

Flags:
  --base <branch>    Base branch to branch from (default: main).
  --no-install       Skip automatic dependency installation.
  --no-test          Skip automatic test verification.
  --json             Output results as JSON (supported by create/list).
  -h, --help         Show help message.

Examples:
  nooa worktree create feat/login
  nooa worktree list
  nooa worktree remove feat/login
  nooa worktree lock feat/login
  nooa worktree prune

Exit Codes:
  0: Success
  1: Runtime Error (git or install failure)
  2: Validation Error (invalid inputs or context)
`;

export const worktreeSdkUsage = `
SDK Usage:
  await worktree.run({ action: "create", branch: "feat/login" });
  await worktree.run({ action: "list" });
`;

export const worktreeUsage = {
	cli: "nooa worktree <subcommand> [args] [flags]",
	sdk: 'await worktree.run({ action: "create", branch: "feat/login" })',
	tui: "WorktreeConsole()",
};

export const worktreeSchema = {
	action: { type: "string", required: true },
	branch: { type: "string", required: false },
	base: { type: "string", required: false },
	"no-install": { type: "boolean", required: false },
	"no-test": { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const worktreeOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "branch", type: "string" },
	{ name: "base", type: "string" },
	{ name: "worktree_path", type: "string" },
	{ name: "skip_install", type: "boolean" },
	{ name: "skip_test", type: "boolean" },
	{ name: "entries", type: "string" },
	{ name: "path", type: "string" },
	{ name: "status", type: "string" },
	{ name: "duration_ms", type: "number" },
	{ name: "raw", type: "string" },
];

export const worktreeErrors = [
	{ code: "worktree.missing_action", message: "Subcommand is required." },
	{ code: "worktree.invalid_input", message: "Invalid input." },
	{ code: "worktree.runtime_error", message: "Runtime error." },
];

export const worktreeExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const worktreeExamples = [
	{
		input: "nooa worktree create feat/login",
		output: "Create a new isolated worktree for the login feature.",
	},
	{
		input: "nooa worktree list --json",
		output: "List all active worktrees in JSON format.",
	},
	{
		input: "nooa worktree remove feat/login",
		output: "Remove the worktree for the login feature.",
	},
	{ input: "nooa worktree prune", output: "Prune stale worktrees." },
];

export interface WorktreeRunInput {
	action?: WorktreeAction;
	branch?: string;
	base?: string;
	"no-install"?: boolean;
	"no-test"?: boolean;
	json?: boolean;
	bus?: EventBus;
	traceId?: string;
}

export interface WorktreeRunResult {
	mode: WorktreeAction;
	branch?: string;
	base?: string;
	worktree_path?: string;
	skip_install?: boolean;
	skip_test?: boolean;
	entries?: unknown;
	path?: string;
	status?: string;
	duration_ms?: number;
	raw?: string;
}

export async function run(
	input: WorktreeRunInput,
): Promise<SdkResult<WorktreeRunResult>> {
	const action = input.action;
	if (!action) {
		return {
			ok: false,
			error: sdkError("worktree.missing_action", "Subcommand is required."),
		};
	}

	if (action === "help") {
		return { ok: true, data: { mode: "help", raw: worktreeHelp } };
	}

	try {
		switch (action) {
			case "create": {
				const result = await createWorktree({
					branch: input.branch,
					base: input.base,
					noInstall: Boolean(input["no-install"]),
					noTest: Boolean(input["no-test"]),
					cwd: process.cwd(),
				});
				return {
					ok: true,
					data: {
						mode: "create",
						branch: result.branch,
						base: result.base,
						worktree_path: result.path,
						skip_install: result.skipInstall,
						skip_test: result.skipTest,
						duration_ms: result.durationMs,
					},
				};
			}
			case "list": {
				const result = await listWorktrees({ cwd: process.cwd() });
				return {
					ok: true,
					data: {
						mode: "list",
						entries: result.entries,
						raw: result.raw,
					},
				};
			}
			case "remove": {
				const result = await removeWorktree({
					branch: input.branch,
					cwd: process.cwd(),
				});
				return {
					ok: true,
					data: { mode: "remove", path: result.path, branch: input.branch },
				};
			}
			case "prune": {
				await pruneWorktrees({ cwd: process.cwd() });
				return { ok: true, data: { mode: "prune" } };
			}
			case "lock": {
				const result = await lockWorktree({
					branch: input.branch,
					lock: true,
					cwd: process.cwd(),
				});
				return {
					ok: true,
					data: { mode: "lock", path: result.path, branch: input.branch },
				};
			}
			case "unlock": {
				const result = await lockWorktree({
					branch: input.branch,
					lock: false,
					cwd: process.cwd(),
				});
				return {
					ok: true,
					data: { mode: "unlock", path: result.path, branch: input.branch },
				};
			}
			case "info": {
				const result = await worktreeInfo({
					branch: input.branch,
					cwd: process.cwd(),
				});
				return {
					ok: true,
					data: { mode: "info", ...result.entry },
				};
			}
			default:
				return { ok: true, data: { mode: "help", raw: worktreeHelp } };
		}
	} catch (error) {
		if (error instanceof WorktreeError) {
			return {
				ok: false,
				error: sdkError(
					error.exitCode === 2
						? "worktree.invalid_input"
						: "worktree.runtime_error",
					error.message,
				),
			};
		}
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("worktree.runtime_error", message),
		};
	}
}

const worktreeBuilder = new CommandBuilder<
	WorktreeRunInput,
	WorktreeRunResult
>()
	.meta(worktreeMeta)
	.usage(worktreeUsage)
	.schema(worktreeSchema)
	.help(worktreeHelp)
	.sdkUsage(worktreeSdkUsage)
	.outputFields(worktreeOutputFields)
	.examples(worktreeExamples)
	.errors(worktreeErrors)
	.exitCodes(worktreeExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			base: { type: "string" },
			"no-install": { type: "boolean" },
			"no-test": { type: "boolean" },
		},
	})
	.parseInput(async ({ values, positionals, bus, traceId }) => {
		const requested = positionals[1];
		if (!requested) {
			return {
				action: undefined,
				branch: undefined,
				base: values.base as string | undefined,
				"no-install": Boolean(values["no-install"]),
				"no-test": Boolean(values["no-test"]),
				json: Boolean(values.json),
				bus,
				traceId,
			};
		}

		const action: WorktreeAction = ACTIONS.includes(requested as WorktreeAction)
			? (requested as WorktreeAction)
			: "create";
		const branch =
			action === "create" && action !== requested ? requested : positionals[2];

		return {
			action,
			branch,
			base: values.base as string | undefined,
			"no-install": Boolean(values["no-install"]),
			"no-test": Boolean(values["no-test"]),
			json: Boolean(values.json),
			bus,
			traceId,
		};
	})
	.run(run)
	.onSuccess((output, values, input) => {
		if (output.mode === "help") {
			console.log(output.raw ?? worktreeHelp);
			process.exitCode = 2;
			return;
		}

		if (values.json) {
			if (output.mode === "create") {
				renderJson({
					branch: output.branch,
					base: output.base,
					worktree_path: output.worktree_path,
					skip_install: output?.skip_install,
					skip_test: output?.skip_test,
					duration_ms: output.duration_ms,
				});
				if (output.worktree_path && output.branch) {
					input.bus?.emit("worktree.acquired", {
						type: "worktree.acquired",
						traceId: input.traceId ?? "",
						path: output.worktree_path,
						branch: output.branch,
					});
				}
				return;
			}
			if (output.mode === "list") {
				renderJson({ worktrees: output.entries });
				return;
			}
			if (output.mode === "info") {
				renderJson(output);
				return;
			}
		}

		switch (output.mode) {
			case "create":
				console.error(`Worktree created: ${output.worktree_path}`);
				console.error(`Branch: ${output.branch} (from ${output.base})`);
				console.error(`Install: ${output?.skip_install ? "skipped" : "done"}`);
				console.error(`Tests: ${output?.skip_test ? "skipped" : "passed"}`);
				if (output.worktree_path && output.branch) {
					input.bus?.emit("worktree.acquired", {
						type: "worktree.acquired",
						traceId: input.traceId ?? "",
						path: output.worktree_path,
						branch: output.branch,
					});
				}
				return;
			case "list":
				if (output.raw) console.log(String(output.raw).trim());
				return;
			case "remove":
				console.error(`Worktree removed: ${output.path}`);
				if (output.path) {
					input.bus?.emit("worktree.released", {
						type: "worktree.released",
						traceId: input.traceId ?? "",
						path: output.path,
					});
				}
				return;
			case "prune":
				console.error("Worktrees pruned.");
				return;
			case "lock":
				console.error(`Worktree locked: ${output.path}`);
				return;
			case "unlock":
				console.error(`Worktree unlocked: ${output.path}`);
				return;
			case "info":
				console.log(`Worktree: ${output.path}`);
				console.log(`Branch: ${output.branch ?? "unknown"}`);
				if (output.status) {
					console.log(`Status: ${output.status}`);
				}
				return;
			default:
				console.log(worktreeHelp);
		}
	})
	.onFailure((error) => {
		if (error.code === "worktree.missing_action") {
			console.log(worktreeHelp);
			setExitCode(error, ["worktree.missing_action"]);
			return;
		}
		handleCommandError(error, ["worktree.invalid_input"]);
	});

export const worktreeAgentDoc = worktreeBuilder.buildAgentDoc(false);
export const worktreeFeatureDoc = (includeChangelog: boolean) =>
	worktreeBuilder.buildFeatureDoc(includeChangelog);

export default worktreeBuilder.build();
