import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { EventBus } from "../../core/event-bus";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { git } from "./git";

export type WorktreeEntry = {
	path: string;
	branch?: string;
	status?: string;
};

export class WorktreeError extends Error {
	readonly exitCode: number;
	readonly metadata?: Record<string, unknown>;

	constructor(
		message: string,
		exitCode = 1,
		metadata?: Record<string, unknown>,
	) {
		super(message);
		this.exitCode = exitCode;
		this.metadata = metadata;
	}
}

export interface WorktreeCreateInput {
	branch?: string;
	base?: string;
	noInstall?: boolean;
	noTest?: boolean;
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
}

export interface WorktreeCreateResult {
	traceId: string;
	path: string;
	branch: string;
	base: string;
	skipInstall: boolean;
	skipTest: boolean;
	durationMs: number;
}

export interface WorktreeListInput {
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
}

export interface WorktreeListResult {
	traceId: string;
	entries: WorktreeEntry[];
	raw: string;
}

export interface WorktreeInfoInput {
	branch?: string;
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
}

export interface WorktreeInfoResult {
	traceId: string;
	entry: WorktreeEntry;
}

export interface WorktreeRemoveInput {
	branch?: string;
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
}

export interface WorktreePruneInput {
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
}

export interface WorktreeLockInput {
	branch?: string;
	lock: boolean;
	cwd?: string;
	traceId?: string;
	bus?: EventBus;
}

export async function createWorktree(
	input: WorktreeCreateInput,
): Promise<WorktreeCreateResult> {
	const traceId = input.traceId ?? createTraceId();
	const startTime = Date.now();
	logger.setContext({ trace_id: traceId, command: "worktree" });

	const root = await resolveRepoRoot(input.cwd);

	if (!input.branch) {
		throw fail(
			"worktree.failure",
			traceId,
			"Branch name is required.",
			input.bus,
			2,
		);
	}

	const branchCheck = await git(
		["check-ref-format", "--branch", input.branch],
		root,
	);
	if (branchCheck.exitCode !== 0) {
		throw fail(
			"worktree.failure",
			traceId,
			"Invalid branch name (check git naming rules).",
			input.bus,
			2,
		);
	}

	const base = input.base ?? "main";
	const resolvedBase = await resolveBaseBranch(base, root);
	if (!resolvedBase) {
		throw fail(
			"worktree.failure",
			traceId,
			`Base branch '${base}' not found locally or in origin.`,
			input.bus,
			2,
			{ base },
		);
	}

	const worktreeDir = determineWorktreeDir(root);
	const worktreePath = join(root, worktreeDir, input.branch);

	await git(["worktree", "prune"], root);

	if (existsSync(worktreePath)) {
		throw fail(
			"worktree.failure",
			traceId,
			`Worktree '${input.branch}' already exists.`,
			input.bus,
			2,
			{ branch: input.branch },
		);
	}

	if (!existsSync(join(root, worktreeDir))) {
		await mkdir(join(root, worktreeDir), { recursive: true });
	}

	await ensureIgnored(worktreeDir, root);

	const branchExists = await git(
		["show-ref", "--verify", `refs/heads/${input.branch}`],
		root,
	);
	const addArgs =
		branchExists.exitCode === 0
			? ["worktree", "add", worktreePath, input.branch]
			: ["worktree", "add", worktreePath, "-b", input.branch, resolvedBase];
	const addResult = await git(addArgs, root);
	if (addResult.exitCode !== 0) {
		throw fail(
			"worktree.failure",
			traceId,
			`Git worktree failed: ${addResult.stderr}`,
			input.bus,
			1,
			{ stderr: String(addResult.stderr).trim() },
		);
	}

	const skipInstall =
		Boolean(input.noInstall) || process.env.NOOA_SKIP_INSTALL === "1";
	const skipTest = Boolean(input.noTest) || process.env.NOOA_SKIP_TEST === "1";

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
			throw fail(
				"worktree.failure",
				traceId,
				"Dependency install failed.",
				input.bus,
				1,
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
			throw fail("worktree.failure", traceId, "Tests failed.", input.bus, 1);
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
				branch: input.branch,
				base,
				worktree_path: worktreePath,
				skip_install: skipInstall,
				skip_test: skipTest,
				duration_ms: durationMs,
			},
		},
		input.bus,
	);

	return {
		traceId,
		path: worktreePath,
		branch: input.branch,
		base,
		skipInstall,
		skipTest,
		durationMs,
	};
}

export async function listWorktrees(
	input: WorktreeListInput = {},
): Promise<WorktreeListResult> {
	const traceId = input.traceId ?? createTraceId();
	logger.setContext({ trace_id: traceId, command: "worktree" });
	const root = await resolveRepoRoot(input.cwd);
	let entries: WorktreeEntry[];
	let rawOutput = "";
	try {
		const list = await fetchWorktreeList(root);
		entries = list.entries;
		rawOutput = list.raw;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to list worktrees.";
		throw fail("worktree.failure", traceId, message, input.bus, 1);
	}

	telemetry.track(
		{
			event: "worktree.list",
			level: "info",
			success: true,
			trace_id: traceId,
			metadata: { worktrees: entries },
		},
		input.bus,
	);

	return { traceId, entries, raw: rawOutput };
}

export async function worktreeInfo(
	input: WorktreeInfoInput,
): Promise<WorktreeInfoResult> {
	const traceId = input.traceId ?? createTraceId();
	logger.setContext({ trace_id: traceId, command: "worktree" });
	const root = await resolveRepoRoot(input.cwd);
	if (!input.branch) {
		throw fail(
			"worktree.failure",
			traceId,
			"Branch name is required.",
			input.bus,
			2,
		);
	}

	let entries: WorktreeEntry[];
	try {
		entries = (await fetchWorktreeList(root)).entries;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to list worktrees.";
		throw fail("worktree.failure", traceId, message, input.bus, 1);
	}

	const entry = entries.find((item) => item.branch === input.branch);
	if (!entry) {
		throw fail(
			"worktree.failure",
			traceId,
			`Worktree '${input.branch}' not found.`,
			input.bus,
			2,
		);
	}

	telemetry.track(
		{
			event: "worktree.info",
			level: "info",
			success: true,
			trace_id: traceId,
			metadata: entry,
		},
		input.bus,
	);

	return { traceId, entry };
}

export async function removeWorktree(
	input: WorktreeRemoveInput,
): Promise<{ traceId: string; path: string }> {
	const traceId = input.traceId ?? createTraceId();
	logger.setContext({ trace_id: traceId, command: "worktree" });
	const root = await resolveRepoRoot(input.cwd);
	if (!input.branch) {
		throw fail(
			"worktree.failure",
			traceId,
			"Branch name is required.",
			input.bus,
			2,
		);
	}
	const worktreeDir = determineWorktreeDir(root);
	const target = join(root, worktreeDir, input.branch);
	if (!existsSync(target)) {
		throw fail(
			"worktree.failure",
			traceId,
			`Worktree '${input.branch}' not found.`,
			input.bus,
			2,
		);
	}

	const result = await git(["worktree", "remove", target], root);
	if (result.exitCode !== 0) {
		throw fail(
			"worktree.failure",
			traceId,
			String(result.stderr),
			input.bus,
			1,
			{ stderr: String(result.stderr).trim() },
		);
	}

	return { traceId, path: target };
}

export async function pruneWorktrees(
	input: WorktreePruneInput = {},
): Promise<{ traceId: string }> {
	const traceId = input.traceId ?? createTraceId();
	logger.setContext({ trace_id: traceId, command: "worktree" });
	const root = await resolveRepoRoot(input.cwd);
	const result = await git(["worktree", "prune"], root);
	if (result.exitCode !== 0) {
		throw fail(
			"worktree.failure",
			traceId,
			"Failed to prune worktrees.",
			input.bus,
			1,
		);
	}
	return { traceId };
}

export async function lockWorktree(
	input: WorktreeLockInput,
): Promise<{ traceId: string; path: string; lock: boolean }> {
	const traceId = input.traceId ?? createTraceId();
	logger.setContext({ trace_id: traceId, command: "worktree" });
	const root = await resolveRepoRoot(input.cwd);
	if (!input.branch) {
		throw fail(
			"worktree.failure",
			traceId,
			"Branch name is required.",
			input.bus,
			2,
		);
	}
	const worktreeDir = determineWorktreeDir(root);
	const target = join(root, worktreeDir, input.branch);
	if (!existsSync(target)) {
		throw fail(
			"worktree.failure",
			traceId,
			`Worktree '${input.branch}' not found.`,
			input.bus,
			2,
		);
	}
	const cmd = input.lock ? "lock" : "unlock";
	const result = await git(["worktree", cmd, target], root);
	if (result.exitCode !== 0) {
		throw fail(
			"worktree.failure",
			traceId,
			String(result.stderr),
			input.bus,
			1,
			{ stderr: String(result.stderr).trim() },
		);
	}
	return { traceId, path: target, lock: input.lock };
}

async function resolveRepoRoot(cwd?: string) {
	const rootCwd = cwd ?? process.cwd();
	const repoRoot = await git(["rev-parse", "--show-toplevel"], rootCwd);
	if (repoRoot.exitCode !== 0) {
		throw fail(
			"worktree.failure",
			createTraceId(),
			"Not a git repository.",
			undefined,
			2,
		);
	}
	return repoRoot.stdout.trim();
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

async function resolveBaseBranch(base: string, root: string) {
	const baseLocal = await git(
		["show-ref", "--verify", `refs/heads/${base}`],
		root,
	);
	if (baseLocal.exitCode === 0) return base;
	const baseRemote = await git(
		["show-ref", "--verify", `refs/remotes/origin/${base}`],
		root,
	);
	if (baseRemote.exitCode === 0) return `origin/${base}`;
	return null;
}

function determineWorktreeDir(root: string) {
	if (existsSync(join(root, ".worktrees"))) return ".worktrees";
	if (existsSync(join(root, "worktrees"))) return "worktrees";
	return ".worktrees";
}

async function ensureIgnored(worktreeDir: string, root: string) {
	const ignoreCheck = await git(["check-ignore", "-q", worktreeDir], root);
	if (ignoreCheck.exitCode === 0) return;
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
	event: string,
	traceId: string,
	message: string,
	bus?: EventBus,
	exitCode = 1,
	metadata?: Record<string, unknown>,
): WorktreeError {
	telemetry.track(
		{
			event,
			level: "error",
			success: false,
			trace_id: traceId,
			metadata: { error_message: message, ...metadata },
		},
		bus,
	);
	logger.error("worktree.failure", new Error(message), {
		trace_id: traceId,
		...metadata,
	});
	return new WorktreeError(message, exitCode, metadata);
}
