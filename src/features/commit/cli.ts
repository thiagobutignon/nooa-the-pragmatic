import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import {
    ensureGitRepo,
    git,
    hasPendingChanges,
    hasStagedChanges,
} from "./guards";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { execa } from "execa";

const commitHelp = `
Usage: nooa commit -m <message> [flags]

Commit staged changes with validation (TDD, no forbidden markers).

Flags:
  -m <message>   Commit message (required).
  --no-test      Skip automatic test verification.
  --allow-todo   Allow TODO/MOCK markers in the code.
  -h, --help     Show help message.

Examples:
  nooa commit -m "feat: user authentication"
  nooa commit -m "docs: api reference" --allow-todo

Exit Codes:
  0: Success
  1: Runtime Error (git failure or tests failed)
  2: Validation Error (missing message or local guards failed)
`;

const commitCommand: Command = {
	name: "commit",
	description: "Commit staged changes with validation",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				m: { type: "string", short: "m" },
				"no-test": { type: "boolean" },
				"allow-todo": { type: "boolean" },
			},
			strict: true,
			allowPositionals: true,
		});

		if (values.help) {
			console.log(commitHelp);
			return;
		}

		const traceId = createTraceId();
		const startTime = Date.now();
		logger.setContext({ trace_id: traceId, command: "commit" });

		if (!values.m) {
			console.error("Error: Commit message is required. Use -m <message>.");
			process.exitCode = 2;
			return;
		}

		const cwd = process.cwd();
		if (!(await ensureGitRepo(cwd))) {
			console.error("Error: Not a git repository.");
			process.exitCode = 2;
			return;
		}

		if (!(await hasPendingChanges(cwd))) {
			console.error("Error: No changes to commit.");
			process.exitCode = 2;
			return;
		}

		if (!(await hasStagedChanges(cwd))) {
			console.error("Error: No staged changes.");
			process.exitCode = 2;
			return;
		}

		if (!values["allow-todo"]) {
            const engine = new PolicyEngine();
            const { stdout } = await execa("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
            const filesToCheck = stdout.split("\n").filter(f => f.trim() !== "");
            
			const result = await engine.checkFiles(filesToCheck);
			if (!result.ok) {
				console.error("\n❌ Error: Zero-Preguiça violation found:");
				for (const v of result.violations) {
                    console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
                }
                console.error("\nFix these violations or use --allow-todo to override.");
				process.exitCode = 2;
				return;
			}
		}

		telemetry.track(
			{
				event: "commit.started",
				level: "info",
				success: true,
				trace_id: traceId,
				metadata: { allow_todo: Boolean(values["allow-todo"]) },
			},
			bus,
		);

		if (!values["no-test"]) {
			console.log("Running tests...");
			const testResult = await execa("bun", ["test"], {
				cwd,
				reject: false,
				stdio: "inherit",
			});
			if (testResult.exitCode !== 0) {
				console.error("Error: Tests failed.");
				process.exitCode = 1;
				return;
			}
		}

		const commitResult = await git(["commit", "-m", String(values.m)], cwd);
		if (commitResult.exitCode !== 0) {
			console.error(commitResult.stderr || "Error: Git commit failed.");
			telemetry.track(
				{
					event: "commit.failure",
					level: "error",
					success: false,
					duration_ms: Date.now() - startTime,
					trace_id: traceId,
					metadata: {
						error_message: commitResult.stderr?.trim() ?? "commit failed",
					},
				},
				bus,
			);
			process.exitCode = 1;
			return;
		}

		telemetry.track(
			{
				event: "commit.success",
				level: "info",
				success: true,
				duration_ms: Date.now() - startTime,
				trace_id: traceId,
			},
			bus,
		);
	},
};

export default commitCommand;
