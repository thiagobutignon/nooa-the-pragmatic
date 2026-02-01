import type { Command, CommandContext } from "../../core/command";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { git } from "./git";

const worktreeHelp = `
Usage: nooa worktree <branch> [flags]

Manage git worktrees for isolated development.

Arguments:
  <branch>          Name of the new branch and directory.

Flags:
  --base <branch>   Base branch to branch from (default: main).
  --no-install      Skip automatic dependency installation.
  --no-test         Skip automatic test verification.
  --json            Output results as JSON.
  -h, --help        Show help message.

Examples:
  nooa worktree feat/new-api
  nooa worktree fix/bug-123 --base develop --no-test

Exit Codes:
  0: Success
  1: Runtime Error (git or install failure)
  2: Validation Error (invalid branch or not a git repo)
`;

// Bug fix: Use git check-ref-format instead of restrictive regex
// const branchPattern = /^[A-Za-z0-9/_-]+$/; // REMOVED - too restrictive

const worktreeCommand: Command = {
	name: "worktree",
	description: "Manage git worktrees for isolated development",
	execute: async ({ args, values, bus }: CommandContext) => {
		if (values.help) {
			console.log(worktreeHelp);
			return;
		}

		const traceId = createTraceId();
		logger.setContext({ trace_id: traceId, command: "worktree" });
		const startTime = Date.now();
		const branch = args[1];
		if (!branch) {
			console.error("Error: Branch name is required.");
			process.exitCode = 2;
			telemetry.track(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: "Branch name is required." },
				},
				bus,
			);
			return;
		}
		// Bug fix #1: Use git check-ref-format for proper branch validation
		const branchCheck = await git(["check-ref-format", "--branch", branch], process.cwd());
		if (branchCheck.exitCode !== 0) {
			console.error("Error: Invalid branch name (check git naming rules).");
			process.exitCode = 2;
			telemetry.track(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: "Invalid branch name." },
				},
				bus,
			);
			return;
		}

		telemetry.track(
			{
				event: "worktree.started",
				level: "info",
				success: true,
				trace_id: traceId,
				metadata: { branch },
			},
			bus,
		);

		const repoRoot = await git(["rev-parse", "--show-toplevel"], process.cwd());
		if (repoRoot.exitCode !== 0) {
			console.error("Error: Not a git repository.");
			process.exitCode = 2;
			telemetry.track(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: "Not a git repository." },
				},
				bus,
			);
			return;
		}
		const root = repoRoot.stdout.trim();
		const base = (values.base as string | undefined) ?? "main";

		// Bug fix #2: Support remote base branches (e.g., origin/develop)
		const baseLocal = await git(["show-ref", "--verify", `refs/heads/${base}`], root);
		const baseRemote = baseLocal.exitCode === 0
			? null
			: await git(["show-ref", "--verify", `refs/remotes/origin/${base}`], root);
		const resolvedBase = baseLocal.exitCode === 0 ? base : (baseRemote?.exitCode === 0 ? `origin/${base}` : null);
		
		if (!resolvedBase) {
			console.error(`Error: Base branch '${base}' not found locally or in origin.`);
			process.exitCode = 2;
			telemetry.track(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: `Base branch '${base}' not found.` },
				},
				bus,
			);
			return;
		}

		const worktreeDir = existsSync(join(root, ".worktrees"))
			? ".worktrees"
			: existsSync(join(root, "worktrees"))
				? "worktrees"
				: ".worktrees";
		const worktreePath = join(root, worktreeDir, branch);

		// Bug fix #3: Prune stale worktrees before checking existence
		await git(["worktree", "prune"], root);
		
		if (existsSync(worktreePath)) {
			console.error(`Error: Worktree '${branch}' already exists.`);
			process.exitCode = 2;
			telemetry.track(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: `Worktree '${branch}' already exists.` },
				},
				bus,
			);
			return;
		}

		if (!existsSync(join(root, worktreeDir))) {
			await mkdir(join(root, worktreeDir), { recursive: true });
		}

		const ignoreCheck = await git(["check-ignore", "-q", worktreeDir], root);
		if (ignoreCheck.exitCode !== 0) {
			const gitignorePath = join(root, ".gitignore");
			const current = existsSync(gitignorePath)
				? await readFile(gitignorePath, "utf-8")
				: "";
			// Bug fix #4: Handle gitignore variations (with/without trailing /)
			const hasIgnore = current.includes(`${worktreeDir}\n`) || current.includes(`${worktreeDir}/\n`) || current.includes(`${worktreeDir}/`);
			if (!hasIgnore) {
				const next =
					current +
					(current.endsWith("\n") || current.length === 0 ? "" : "\n") +
					`${worktreeDir}/\n`;
				await writeFile(gitignorePath, next);
			}
		}

		const branchExists = await git(
			["show-ref", "--verify", `refs/heads/${branch}`],
			root,
		);
		const addArgs =
			branchExists.exitCode === 0
				? ["worktree", "add", worktreePath, branch]
				: ["worktree", "add", worktreePath, "-b", branch, resolvedBase];
		const addResult = await git(addArgs, root);
		if (addResult.exitCode !== 0) {
			console.error(`Error: Git worktree failed: ${addResult.stderr}`);
			process.exitCode = 1;
			telemetry.track(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: String(addResult.stderr).trim() },
				},
				bus,
			);
			return;
		}

		const skipInstall = Boolean(values["no-install"]) ||
			process.env.NOOA_SKIP_INSTALL === "1";
		const skipTest = Boolean(values["no-test"]) ||
			process.env.NOOA_SKIP_TEST === "1";
		const childEnv = { ...process.env };
		delete childEnv.BUN_TEST;
		delete childEnv.BUN_TEST_FILE;
		delete childEnv.BUN_TEST_NAME;

		if (!skipInstall && existsSync(join(worktreePath, "package.json"))) {
			const installResult = await execa("bun", ["install"], {
				cwd: worktreePath,
				reject: false,
				env: childEnv,
			});
			if (installResult.exitCode !== 0) {
				console.error("Error: Dependency install failed.");
				process.exitCode = 1;
				telemetry.track(
					{
						event: "worktree.failure",
						level: "error",
						success: false,
						trace_id: traceId,
						metadata: { error_message: "Dependency install failed." },
					},
					bus,
				);
				return;
			}
		}

		if (!skipTest) {
			const testResult = await execa("bun", ["test"], {
				cwd: worktreePath,
				reject: false,
				env: childEnv,
			});
			if (testResult.exitCode !== 0) {
				console.error("Error: Tests failed.");
				if (testResult.stderr) {
					console.error(testResult.stderr);
				}
				process.exitCode = 1;
				telemetry.track(
					{
						event: "worktree.failure",
						level: "error",
						success: false,
						trace_id: traceId,
						metadata: { error_message: "Tests failed." },
					},
					bus,
				);
				return;
			}
		}

		const durationMs = Date.now() - startTime;
		telemetry.track(
			{
				event: "worktree.success",
				level: "info",
				success: true,
				trace_id: traceId,
				metadata: {
					branch,
					base,
					worktree_path: worktreePath,
					skip_install: skipInstall,
					skip_test: skipTest,
					duration_ms: durationMs,
				},
			},
			bus,
		);

		console.error(`Worktree created: ${worktreePath}`);
		console.error(`Branch: ${branch} (from ${base})`);
		console.error(`Install: ${skipInstall ? "skipped" : "done"}`);
		console.error(`Tests: ${skipTest ? "skipped" : "passed"}`);
	},
};

export default worktreeCommand;
