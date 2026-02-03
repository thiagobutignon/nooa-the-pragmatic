import type { WorktreeEntry } from "../features/worktree/execute";
import {
	WorktreeError,
	createWorktree,
	listWorktrees,
	lockWorktree,
	pruneWorktrees,
	removeWorktree,
	worktreeInfo,
} from "../features/worktree/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface WorktreeCreateInput {
	branch?: string;
	base?: string;
	noInstall?: boolean;
	noTest?: boolean;
	cwd?: string;
}

export interface WorktreeCreateResult {
	ok: boolean;
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
}

export interface WorktreeListResult {
	ok: boolean;
	traceId: string;
	entries: WorktreeEntry[];
	raw: string;
}

export interface WorktreeInfoInput {
	branch?: string;
	cwd?: string;
}

export interface WorktreeInfoResult {
	ok: boolean;
	traceId: string;
	entry: WorktreeEntry;
}

export interface WorktreeRemoveInput {
	branch?: string;
	cwd?: string;
}

export interface WorktreeLockInput {
	branch?: string;
	cwd?: string;
}

function mapWorktreeError(error: WorktreeError) {
	const code = error.exitCode === 2 ? "validation_error" : "runtime_error";
	return sdkError(code, error.message, error.metadata);
}

export async function create(
	input: WorktreeCreateInput,
): Promise<SdkResult<WorktreeCreateResult>> {
	try {
		const result = await createWorktree({
			branch: input.branch,
			base: input.base,
			noInstall: input.noInstall,
			noTest: input.noTest,
			cwd: input.cwd,
		});
		return {
			ok: true,
			data: {
				ok: true,
				traceId: result.traceId,
				path: result.path,
				branch: result.branch,
				base: result.base,
				skipInstall: result.skipInstall,
				skipTest: result.skipTest,
				durationMs: result.durationMs,
			},
		};
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree create failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function list(
	input: WorktreeListInput = {},
): Promise<SdkResult<WorktreeListResult>> {
	try {
		const result = await listWorktrees({ cwd: input.cwd });
		return {
			ok: true,
			data: {
				ok: true,
				traceId: result.traceId,
				entries: result.entries,
				raw: result.raw,
			},
		};
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree list failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function info(
	input: WorktreeInfoInput,
): Promise<SdkResult<WorktreeInfoResult>> {
	try {
		const result = await worktreeInfo({ branch: input.branch, cwd: input.cwd });
		return {
			ok: true,
			data: {
				ok: true,
				traceId: result.traceId,
				entry: result.entry,
			},
		};
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree info failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function remove(
	input: WorktreeRemoveInput,
): Promise<SdkResult<{ ok: boolean; traceId: string; path: string }>> {
	try {
		const result = await removeWorktree({ branch: input.branch, cwd: input.cwd });
		return {
			ok: true,
			data: { ok: true, traceId: result.traceId, path: result.path },
		};
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree remove failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function prune(
	input: WorktreeListInput = {},
): Promise<SdkResult<{ ok: boolean; traceId: string }>> {
	try {
		const result = await pruneWorktrees({ cwd: input.cwd });
		return { ok: true, data: { ok: true, traceId: result.traceId } };
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree prune failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function lock(
	input: WorktreeLockInput,
): Promise<SdkResult<{ ok: boolean; traceId: string; path: string; lock: boolean }>> {
	try {
		const result = await lockWorktree({ branch: input.branch, cwd: input.cwd, lock: true });
		return {
			ok: true,
			data: { ok: true, traceId: result.traceId, path: result.path, lock: true },
		};
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree lock failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function unlock(
	input: WorktreeLockInput,
): Promise<SdkResult<{ ok: boolean; traceId: string; path: string; lock: boolean }>> {
	try {
		const result = await lockWorktree({ branch: input.branch, cwd: input.cwd, lock: false });
		return {
			ok: true,
			data: { ok: true, traceId: result.traceId, path: result.path, lock: false },
		};
	} catch (error) {
		if (error instanceof WorktreeError) {
			return { ok: false, error: mapWorktreeError(error) };
		}
		return {
			ok: false,
			error: sdkError("runtime_error", "Worktree unlock failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const worktree = {
	create,
	list,
	info,
	remove,
	prune,
	lock,
	unlock,
};
