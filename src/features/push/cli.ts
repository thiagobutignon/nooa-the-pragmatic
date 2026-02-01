import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { telemetry } from "../../core/telemetry";
import { ensureGitRepo, git, isWorkingTreeClean } from "./guards";

const pushHelp = `
Usage: nooa push [remote] [branch] [flags]

Push committed changes to the remote repository.

Arguments:
  [remote]       Git remote name (default: origin).
  [branch]       Git branch name (default: current branch).

Flags:
  --no-test      Skip automatic test verification before pushing.
  --json         Output result as JSON.
  -h, --help     Show help message.

Examples:
  nooa push
  nooa push origin feat/auth --no-test

Exit Codes:
  0: Success
  1: Runtime Error (git push failed)
  2: Validation Error (not a git repo or dirty tree)
  3: Test Failure (pre-push tests failed)
`;

const pushCommand: Command = {
	name: "push",
	description: "Push changes to remote repository",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				"no-test": { type: "boolean" },
				json: { type: "boolean" },
			},
			strict: true,
			allowPositionals: true,
		});

		if (values.help) {
			console.log(pushHelp);
			return;
		}

		const traceId = createTraceId();
		const startTime = Date.now();
		logger.setContext({ trace_id: traceId, command: "push" });

		const cwd = process.env.NOOA_CWD ?? process.env.PWD ?? process.cwd();
		if (!(await ensureGitRepo(cwd))) {
			console.error("Error: Not a git repository.");
			process.exitCode = 2;
			return;
		}

		if (!(await isWorkingTreeClean(cwd))) {
			console.error("Error: Uncommitted changes detected.");
			process.exitCode = 2;
			return;
		}

		console.log("Auditing code policies...");
		const engine = new PolicyEngine();
		const filesToCheck = await growFileList(cwd);
		const policyResult = await engine.checkFiles(filesToCheck);
		if (!policyResult.ok) {
			if (values.json) {
				console.log(
					JSON.stringify(
						{ ok: false, violations: policyResult.violations },
						null,
						2,
					),
				);
			} else {
				console.error(
					`\n❌ Error: Policy violations found in the project (${policyResult.violations.length}). Push blocked.`,
				);
				for (const v of policyResult.violations) {
					console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
				}
			}
			process.exitCode = 2;
			return;
		}

		telemetry.track(
			{
				event: "push.started",
				level: "info",
				success: true,
				trace_id: traceId,
			},
			bus,
		);

		if (!values["no-test"]) {
			const testResult = await execa("bun", ["test"], { cwd, reject: false });
			if (testResult.exitCode !== 0) {
				console.error("Error: Tests failed.");
				process.exitCode = 3;
				return;
			}
		}

		const remote = positionals[1];
		const branch = positionals[2];
		const args = [
			"push",
			...(remote ? [remote] : []),
			...(branch ? [branch] : []),
		];
		const pushResult = await git(args, cwd);
		if (pushResult.exitCode !== 0) {
			console.error(pushResult.stderr || "Error: Git push failed.");
			telemetry.track(
				{
					event: "push.failure",
					level: "error",
					success: false,
					duration_ms: Date.now() - startTime,
					trace_id: traceId,
					metadata: {
						error_message: pushResult.stderr?.trim() ?? "push failed",
					},
				},
				bus,
			);
			process.exitCode = 1;
			return;
		}
		telemetry.track(
			{
				event: "push.success",
				level: "info",
				success: true,
				duration_ms: Date.now() - startTime,
				trace_id: traceId,
			},
			bus,
		);

		if (values.json) {
			console.log(
				JSON.stringify(
					{ ok: true, traceId, message: "Push successful" },
					null,
					2,
				),
			);
		} else {
			console.log(`✅ Push successful [${traceId}]`);
		}
	},
};
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
			)
				continue;
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

export default pushCommand;
