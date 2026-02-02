import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { git } from "./git";

type WorktreeAction =
	| "create"
	| "list"
	| "remove"
	| "prune"
	| "lock"
	| "unlock"
	| "info";

type WorktreeEntry = {
	path: string;
	branch?: string;
	status?: string;
};

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
		logger.setContext({ trace_id: traceId, command: "worktree" });
		const startTime = Date.now();

		const repoRoot = await git(["rev-parse", "--show-toplevel"], process.cwd());
		if (repoRoot.exitCode !== 0) {
			return fail(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: "Not a git repository." },
				},
				"Error: Not a git repository.",
				bus,
				2,
			);
		}

		const root = repoRoot.stdout.trim();

		switch (action) {
			case "create":
				return handleCreate({
					traceId,
					root,
					branch: branchArg,
					values,
					bus,
					startTime,
				});
			// ...
			case "list":
				return handleList({ traceId, root, values, bus });
			case "remove":
				return handleRemove({ traceId, root, branch: branchArg, bus });
			case "prune":
				return handlePrune({ traceId, root, bus });
			case "lock":
				return handleLock({ traceId, root, branch: branchArg, bus });
			case "unlock":
				return handleUnlock({ traceId, root, branch: branchArg, bus });
			case "info":
				return handleInfo({
					traceId,
					root,
					branch: branchArg,
					bus,
					values,
				});
			default:
				return fail(
					{
						event: "worktree.failure",
						level: "error",
						success: false,
						trace_id: traceId,
						metadata: { error_message: "Unknown action." },
					},
					`Error: Unknown action '${action}'.`,
					bus,
					2,
				);
		}
	},
};

async function handleCreate({
	traceId,
	root,
	branch,
	values,
	bus,
	startTime,
}: {
	traceId: string;
	root: string;
	branch?: string;
	values: CommandContext["values"];
	bus: CommandContext["bus"];
	startTime: number;
}) {
	if (!branch) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: "Branch name is required." },
			},
			"Error: Branch name is required.",
			bus,
			2,
		);
	}

	const branchCheck = await git(
		["check-ref-format", "--branch", branch],
		process.cwd(),
	);
	if (branchCheck.exitCode !== 0) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: "Invalid branch name." },
			},
			"Error: Invalid branch name (check git naming rules).",
			bus,
			2,
		);
	}

	const base = (values.base as string | undefined) ?? "main";
	const resolvedBase = await resolveBaseBranch(base, root);
	if (!resolvedBase) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: `Base branch '${base}' not found.` },
			},
			`Error: Base branch '${base}' not found locally or in origin.`,
			bus,
			2,
		);
	}

	const worktreeDir = determineWorktreeDir(root);
	const worktreePath = join(root, worktreeDir, branch);

	await git(["worktree", "prune"], root);

	if (existsSync(worktreePath)) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: `Worktree '${branch}' already exists.` },
			},
			`Error: Worktree '${branch}' already exists.`,
			bus,
			2,
		);
	}

	if (!existsSync(join(root, worktreeDir))) {
		await mkdir(join(root, worktreeDir), { recursive: true });
	}

	await ensureIgnored(worktreeDir, root);

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
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: String(addResult.stderr).trim() },
			},
			`Error: Git worktree failed: ${addResult.stderr}`,
			bus,
		);
	}

	const skipInstall =
		Boolean(values["no-install"]) || process.env.NOOA_SKIP_INSTALL === "1";
	const skipTest =
		Boolean(values["no-test"]) || process.env.NOOA_SKIP_TEST === "1";

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
			return fail(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: "Dependency install failed." },
				},
				"Error: Dependency install failed.",
				bus,
			);
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
			return fail(
				{
					event: "worktree.failure",
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error_message: "Tests failed." },
				},
				"Error: Tests failed.",
				bus,
			);
		}
	}

	const durationMs = Date.now() - startTime;
	const payload = {
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
	};
	telemetry.track(payload, bus);

	if (values.json) {
		console.log(JSON.stringify(payload.metadata));
	} else {
		console.error(`Worktree created: ${worktreePath}`);
		console.error(`Branch: ${branch} (from ${base})`);
		console.error(`Install: ${skipInstall ? "skipped" : "done"}`);
		console.error(`Tests: ${skipTest ? "skipped" : "passed"}`);
	}
}

async function handleList({
	traceId,
	root,
	values,
	bus,
}: {
	traceId: string;
	root: string;
	values: CommandContext["values"];
	bus: CommandContext["bus"];
}) {
	let entries: WorktreeEntry[];
	let rawOutput = "";
	try {
		const list = await fetchWorktreeList(root);
		entries = list.entries;
		rawOutput = list.raw;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to list worktrees.";
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: message },
			},
			`Error: ${message}`,
			bus,
		);
	}

	const payload = {
		event: "worktree.list",
		level: "info",
		success: true,
		trace_id: traceId,
		metadata: { worktrees: entries },
	};
	telemetry.track(payload, bus);

	if (values.json) {
		console.log(JSON.stringify({ worktrees: entries }));
	} else {
		console.log(rawOutput.trim());
	}
}

async function handleInfo({
	traceId,
	root,
	branch,
	values,
	bus,
}: {
	traceId: string;
	root: string;
	branch?: string;
	values: CommandContext["values"];
	bus: CommandContext["bus"];
}) {
	if (!branch) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: "Branch name is required." },
			},
			"Error: Branch name is required.",
			bus,
			2,
		);
	}

	let entries: WorktreeEntry[];
	try {
		entries = (await fetchWorktreeList(root)).entries;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to list worktrees.";
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: message },
			},
			`Error: ${message}`,
			bus,
		);
	}

	const entry = entries.find((item) => item.branch === branch);
	if (!entry) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: `Worktree '${branch}' not found.` },
			},
			`Error: Worktree '${branch}' not found.`,
			bus,
			2,
		);
	}

	const payload = {
		event: "worktree.info",
		level: "info",
		success: true,
		trace_id: traceId,
		metadata: entry,
	};
	telemetry.track(payload, bus);

	if (values.json) {
		console.log(JSON.stringify(entry));
	} else {
		console.log(`Worktree: ${entry.path}`);
		console.log(`Branch: ${entry.branch ?? "unknown"}`);
		if (entry.status) {
			console.log(`Status: ${entry.status}`);
		}
	}
}

async function fetchWorktreeList(root: string) {
	const result = await git(["worktree", "list"], root);
	if (result.exitCode !== 0) {
		throw new Error(
			String(result.stderr).trim() || "Failed to list worktrees.",
		);
	}
	const entries = parseWorktreeEntries(
		result.stdout,
		determineWorktreeDir(root),
	);
	return { entries, raw: result.stdout };
}

function parseWorktreeEntries(output: string, worktreeDir: string) {
	return output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line?.includes(worktreeDir))
		.map((line) => {
			const path = line.split(/\s+/)[0];
			const branchMatch = line.match(/\[([^\]]+)\]/);
			const branch = branchMatch
				? branchMatch[1].replace(/^refs\/heads\//, "")
				: undefined;
			const status = line.includes("locked") ? "locked" : undefined;
			return { path, branch, status };
		});
}

async function handleRemove({
	traceId,
	root,
	branch,
	bus,
}: {
	traceId: string;
	root: string;
	branch?: string;
	bus: CommandContext["bus"];
}) {
	if (!branch) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: "Branch name is required." },
			},
			"Error: Branch name is required.",
			bus,
			2,
		);
	}

	const worktreeDir = determineWorktreeDir(root);
	const target = join(root, worktreeDir, branch);
	if (!existsSync(target)) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: `Worktree '${branch}' not found.` },
			},
			`Error: Worktree '${branch}' not found.`,
			bus,
			2,
		);
	}

	const result = await git(["worktree", "remove", target], root);
	if (result.exitCode !== 0) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: String(result.stderr).trim() },
			},
			`Error: ${result.stderr}`,
			bus,
		);
	}

	console.error(`Worktree removed: ${target}`);
}

async function handlePrune({
	traceId,
	root,
	bus,
}: {
	traceId: string;
	root: string;
	bus: CommandContext["bus"];
}) {
	const result = await git(["worktree", "prune"], root);
	if (result.exitCode !== 0) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: "Failed to prune worktrees." },
			},
			"Error: Failed to prune worktrees.",
			bus,
		);
	}
	console.error("Worktrees pruned.");
}

async function handleLock({
	traceId,
	root,
	branch,
	bus,
}: {
	traceId: string;
	root: string;
	branch?: string;
	bus: CommandContext["bus"];
}) {
	return handleLockCommand({ traceId, root, branch, bus, lock: true });
}

async function handleUnlock({
	traceId,
	root,
	branch,
	bus,
}: {
	traceId: string;
	root: string;
	branch?: string;
	bus: CommandContext["bus"];
}) {
	return handleLockCommand({ traceId, root, branch, bus, lock: false });
}

async function handleLockCommand({
	traceId,
	root,
	branch,
	bus,
	lock,
}: {
	traceId: string;
	root: string;
	branch?: string;
	bus: CommandContext["bus"];
	lock: boolean;
}) {
	if (!branch) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: "Branch name is required." },
			},
			"Error: Branch name is required.",
			bus,
			2,
		);
	}

	const worktreeDir = determineWorktreeDir(root);
	const target = join(root, worktreeDir, branch);
	if (!existsSync(target)) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: `Worktree '${branch}' not found.` },
			},
			`Error: Worktree '${branch}' not found.`,
			bus,
			2,
		);
	}

	const cmd = lock ? "lock" : "unlock";
	const result = await git(["worktree", cmd, target], root);
	if (result.exitCode !== 0) {
		return fail(
			{
				event: "worktree.failure",
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error_message: String(result.stderr).trim() },
			},
			`Error: ${result.stderr}`,
			bus,
		);
	}

	console.error(`Worktree ${lock ? "locked" : "unlocked"}: ${target}`);
}

async function resolveBaseBranch(base: string, root: string) {
	const baseLocal = await git(
		["show-ref", "--verify", `refs/heads/${base}`],
		root,
	);
	if (baseLocal.exitCode === 0) {
		return base;
	}
	const baseRemote = await git(
		["show-ref", "--verify", `refs/remotes/origin/${base}`],
		root,
	);
	if (baseRemote.exitCode === 0) {
		return `origin/${base}`;
	}
	return null;
}

function determineWorktreeDir(root: string) {
	if (existsSync(join(root, ".worktrees"))) {
		return ".worktrees";
	}
	if (existsSync(join(root, "worktrees"))) {
		return "worktrees";
	}
	return ".worktrees";
}

async function ensureIgnored(worktreeDir: string, root: string) {
	const ignoreCheck = await git(["check-ignore", "-q", worktreeDir], root);
	if (ignoreCheck.exitCode === 0) {
		return;
	}
	const gitignorePath = join(root, ".gitignore");
	const current = existsSync(gitignorePath)
		? await readFile(gitignorePath, "utf-8")
		: "";
	const candidate =
		current +
		(current.endsWith("\n") || current.length === 0 ? "" : "\n") +
		`${worktreeDir}/\n`;
	await writeFile(gitignorePath, candidate);
}

function fail(
	payload: Parameters<typeof telemetry.track>[0],
	message: string,
	bus: CommandContext["bus"],
	exitCode: number = 1,
) {
	telemetry.track(payload, bus);
	process.exitCode = exitCode;
	console.error(message);
}

export default worktreeCommand;
