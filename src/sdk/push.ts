import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { createTraceId } from "../core/logger";
import { PolicyEngine } from "../core/policy/PolicyEngine";
import { ensureGitRepo, git, isWorkingTreeClean } from "../features/push/guards";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface PushRunInput {
	remote?: string;
	branch?: string;
	noTest?: boolean;
	cwd?: string;
}

export interface PushRunResult {
	ok: boolean;
	traceId: string;
	message: string;
}

export async function run(
	input: PushRunInput,
): Promise<SdkResult<PushRunResult>> {
	const traceId = createTraceId();
	const cwd = input.cwd ?? process.cwd();

	if (!(await ensureGitRepo(cwd))) {
		return {
			ok: false,
			error: sdkError("validation_error", "Not a git repository."),
		};
	}

	if (!(await isWorkingTreeClean(cwd))) {
		return {
			ok: false,
			error: sdkError("validation_error", "Uncommitted changes detected."),
		};
	}

	const engine = new PolicyEngine();
	const filesToCheck = await growFileList(cwd);
	const policyResult = await engine.checkFiles(filesToCheck);
	if (!policyResult.ok) {
		return {
			ok: false,
			error: sdkError("validation_error", "Policy violations found.", {
				violations: policyResult.violations,
			}),
		};
	}

	if (!input.noTest) {
		const testResult = await execa("bun", ["test"], {
			cwd,
			reject: false,
			stdio: "inherit",
		});
		if (testResult.exitCode !== 0) {
			return {
				ok: false,
				error: sdkError("runtime_error", "Tests failed.", {
					exitCode: testResult.exitCode,
				}),
			};
		}
	}

	const remote = input.remote ?? "origin";
	const branch = input.branch ?? (await currentBranch(cwd));
	if (!branch) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Unable to resolve current branch."),
		};
	}
	const args = ["push", remote, branch];
	const pushResult = await git(args, cwd);
	if (pushResult.exitCode !== 0) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Git push failed.", {
				stderr: pushResult.stderr?.trim(),
			}),
		};
	}

	return {
		ok: true,
		data: {
			ok: true,
			traceId,
			message: "Push successful",
		},
	};
}

async function growFileList(path: string): Promise<string[]> {
	try {
		const stat = await lstat(path);
		if (stat.isFile()) return [path];

		const files: string[] = [];
		const entries = await readdir(path, { withFileTypes: true });

		for (const entry of entries) {
			const full = join(path, entry.name);
			if (
				entry.name === ".git" ||
				entry.name === "node_modules" ||
				entry.name === "memory"
			) {
				continue;
			}
			if (entry.isDirectory()) {
				files.push(...(await growFileList(full)));
			} else {
				files.push(full);
			}
		}
		return files;
	} catch {
		return [];
	}
}

async function currentBranch(cwd: string): Promise<string | null> {
	const result = await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
	if (result.exitCode !== 0) return null;
	const branch = result.stdout.trim();
	return branch.length > 0 ? branch : null;
}

export const push = {
	run,
};
