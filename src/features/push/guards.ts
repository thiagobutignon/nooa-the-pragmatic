import { execa } from "execa";

export async function git(args: string[], cwd: string) {
	return execa("git", args, { cwd, reject: false });
}

export async function ensureGitRepo(cwd: string): Promise<boolean> {
	const res = await git(["rev-parse", "--is-inside-work-tree"], cwd);
	return res.exitCode === 0;
}

export async function isWorkingTreeClean(cwd: string): Promise<boolean> {
	const res = await git(["status", "--porcelain"], cwd);
	return res.exitCode === 0 && res.stdout.trim().length === 0;
}
