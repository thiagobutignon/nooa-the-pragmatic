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
	if (res.exitCode !== 0) return false;
	const lines = res.stdout.split("\n").filter(Boolean);
	const filtered = lines.filter((line) => {
		const path = line.slice(3).trim();
		return (
			path !== "nooa.db" && path !== "nooa.db-wal" && path !== "nooa.db-shm"
		);
	});
	return filtered.length === 0;
}
