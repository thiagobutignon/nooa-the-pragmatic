import { execa } from "execa";
import { createTraceId } from "../core/logger";
import { PolicyEngine } from "../core/policy/PolicyEngine";
import { ensureGitRepo, git, hasPendingChanges, hasStagedChanges } from "../features/commit/guards";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface CommitRunInput {
	message?: string;
	noTest?: boolean;
	allowLazy?: boolean;
	cwd?: string;
}

export interface CommitRunResult {
	ok: boolean;
	traceId: string;
	message: string;
}

export async function run(
	input: CommitRunInput,
): Promise<SdkResult<CommitRunResult>> {
	const traceId = createTraceId();
	const cwd = input.cwd ?? process.cwd();

	if (!input.message) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Commit message is required.", {
				field: "message",
			}),
		};
	}

	if (!(await ensureGitRepo(cwd))) {
		return {
			ok: false,
			error: sdkError("validation_error", "Not a git repository."),
		};
	}

	if (!(await hasPendingChanges(cwd))) {
		return {
			ok: false,
			error: sdkError("validation_error", "No changes to commit."),
		};
	}

	if (!(await hasStagedChanges(cwd))) {
		return {
			ok: false,
			error: sdkError("validation_error", "No staged changes."),
		};
	}

	if (!input.allowLazy) {
		const engine = new PolicyEngine();
		const { stdout } = await execa("git", [
			"diff",
			"--cached",
			"--name-only",
			"--diff-filter=ACMR",
		], { cwd, reject: false });
		const filesToCheck = stdout.split("\n").filter((f) => f.trim() !== "");
		const result = await engine.checkFiles(filesToCheck);
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("validation_error", "Policy violations found.", {
					violations: result.violations,
				}),
			};
		}
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

	const commitResult = await git(["commit", "-m", String(input.message)], cwd);
	if (commitResult.exitCode !== 0) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Git commit failed.", {
				stderr: commitResult.stderr?.trim(),
			}),
		};
	}

	return {
		ok: true,
		data: {
			ok: true,
			traceId,
			message: "Commit successful",
		},
	};
}

export const commit = {
	run,
};
