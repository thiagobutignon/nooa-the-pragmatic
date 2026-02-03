import type { Command, CommandContext } from "../../core/command";
import { createTraceId } from "../../core/logger";
import {
	WorktreeError,
	createWorktree,
	listWorktrees,
	lockWorktree,
	pruneWorktrees,
	removeWorktree,
	worktreeInfo,
} from "./execute";

type WorktreeAction =
	| "create"
	| "list"
	| "remove"
	| "prune"
	| "lock"
	| "unlock"
	| "info";

const worktreeHelp = `
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

const ACTIONS: WorktreeAction[] = [
	"create",
	"list",
	"remove",
	"prune",
	"lock",
	"unlock",
	"info",
];

const worktreeCommand: Command = {
	name: "worktree",
	description: "Manage git worktrees for isolated development",
	execute: async ({ args, values, bus }: CommandContext) => {
		if (values.help) {
			console.log(worktreeHelp);
			return;
		}

		const requested = args[1];
		if (!requested) {
			console.log(worktreeHelp);
			process.exitCode = 2;
			return;
		}

		const action = ACTIONS.includes(requested as WorktreeAction)
			? requested
			: "create";
		const branchArg =
			action === "create" && action !== requested ? requested : args[2];
		const traceId = createTraceId();

		try {
			switch (action) {
				case "create": {
					const result = await createWorktree({
						branch: branchArg,
						base: values.base as string | undefined,
						noInstall: Boolean(values["no-install"]),
						noTest: Boolean(values["no-test"]),
						cwd: process.cwd(),
						traceId,
						bus,
					});
					if (values.json) {
						console.log(
							JSON.stringify({
								branch: result.branch,
								base: result.base,
								worktree_path: result.path,
								skip_install: result.skipInstall,
								skip_test: result.skipTest,
								duration_ms: result.durationMs,
							}),
						);
					} else {
						console.error(`Worktree created: ${result.path}`);
						console.error(`Branch: ${result.branch} (from ${result.base})`);
						console.error(`Install: ${result.skipInstall ? "skipped" : "done"}`);
						console.error(`Tests: ${result.skipTest ? "skipped" : "passed"}`);
					}
					return;
				}
				case "list": {
					const result = await listWorktrees({
						cwd: process.cwd(),
						traceId,
						bus,
					});
					if (values.json) {
						console.log(JSON.stringify({ worktrees: result.entries }));
					} else {
						console.log(result.raw.trim());
					}
					return;
				}
				case "remove": {
					const result = await removeWorktree({
						branch: branchArg,
						cwd: process.cwd(),
						traceId,
						bus,
					});
					console.error(`Worktree removed: ${result.path}`);
					return;
				}
				case "prune": {
					await pruneWorktrees({ cwd: process.cwd(), traceId, bus });
					console.error("Worktrees pruned.");
					return;
				}
				case "lock": {
					const result = await lockWorktree({
						branch: branchArg,
						lock: true,
						cwd: process.cwd(),
						traceId,
						bus,
					});
					console.error(`Worktree locked: ${result.path}`);
					return;
				}
				case "unlock": {
					const result = await lockWorktree({
						branch: branchArg,
						lock: false,
						cwd: process.cwd(),
						traceId,
						bus,
					});
					console.error(`Worktree unlocked: ${result.path}`);
					return;
				}
				case "info": {
					const result = await worktreeInfo({
						branch: branchArg,
						cwd: process.cwd(),
						traceId,
						bus,
					});
					if (values.json) {
						console.log(JSON.stringify(result.entry));
					} else {
						console.log(`Worktree: ${result.entry.path}`);
						console.log(`Branch: ${result.entry.branch ?? "unknown"}`);
						if (result.entry.status) {
							console.log(`Status: ${result.entry.status}`);
						}
					}
					return;
				}
				default:
					throw new WorktreeError(`Unknown action '${action}'.`, 2);
			}
		} catch (error) {
			if (error instanceof WorktreeError) {
				const message = error.message.startsWith("Error:")
					? error.message
					: `Error: ${error.message}`;
				console.error(message);
				process.exitCode = error.exitCode;
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Error: ${message}`);
			process.exitCode = 1;
		}
	},
};

export default worktreeCommand;
