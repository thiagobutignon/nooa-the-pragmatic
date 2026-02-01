import { readFile } from "node:fs/promises";
import { execa } from "execa";

const forbiddenPatterns = [
	"TODO:", // nooa-ignore
	"MOCK:", // nooa-ignore
	"Implement this later",
];

export async function git(args: string[], cwd: string) {
	return execa("git", args, { cwd, reject: false });
}

export async function ensureGitRepo(cwd: string): Promise<boolean> {
	const res = await git(["rev-parse", "--is-inside-work-tree"], cwd);
	return res.exitCode === 0;
}

export async function hasPendingChanges(cwd: string): Promise<boolean> {
	const res = await git(["status", "--porcelain"], cwd);
	return res.exitCode === 0 && res.stdout.trim().length > 0;
}

export async function hasStagedChanges(cwd: string): Promise<boolean> {
	const res = await git(["diff", "--cached", "--name-only"], cwd);
	return res.exitCode === 0 && res.stdout.trim().length > 0;
}

export async function findForbiddenMarkers(cwd: string): Promise<string[]> {
	const files = await git(["ls-files"], cwd);
	if (files.exitCode !== 0) return [];
	const results: string[] = [];
	const fileList = files.stdout.split("\n").filter(Boolean);

	for (const file of fileList) {
		try {
			const text = await readFile(`${cwd}/${file}`, "utf-8");
			for (const pattern of forbiddenPatterns) {
				if (text.includes(pattern)) {
					results.push(`${file}: ${pattern}`);
				}
			}
		} catch {
			// ignore unreadable files
		}
	}
	return results;
}
