import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";

export interface WorktreeHandle {
	branch: string;
	path: string;
	root: string;
}

export interface WorktreePoolConfig {
	maxWorktrees: number;
	root?: string;
	worktreeDir?: string;
}

export class WorktreePool {
	private readonly config: WorktreePoolConfig;
	private readonly active = new Map<string, WorktreeHandle>();

	constructor(config: WorktreePoolConfig) {
		this.config = config;
	}

	async acquire(branch: string): Promise<WorktreeHandle> {
		if (this.active.size >= this.config.maxWorktrees) {
			throw new Error("POOL_EXHAUSTED");
		}

		const root = this.config.root ?? (await this.resolveRepoRoot());
		const worktreeDir = this.config.worktreeDir ?? ".worktrees";
		const worktreePath = join(root, worktreeDir, branch);

		await mkdir(join(root, worktreeDir), { recursive: true });
		await execa("git", ["worktree", "add", "-b", branch, worktreePath], {
			cwd: root,
		});

		const handle: WorktreeHandle = { branch, path: worktreePath, root };
		this.active.set(branch, handle);
		return handle;
	}

	async release(handle: WorktreeHandle): Promise<void> {
		await execa("git", ["worktree", "remove", handle.path], {
			cwd: handle.root,
		});
		this.active.delete(handle.branch);
	}

	list(): WorktreeHandle[] {
		return Array.from(this.active.values());
	}

	private async resolveRepoRoot(): Promise<string> {
		const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
		return stdout.trim();
	}
}
