import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import { runFix } from "./execute";

const fixHelp = `
Usage: nooa fix <issue> [flags]

Autonomous agent loop: worktree → context → patch → verify → commit.

Arguments:
  <issue>        A description or ID of the bug/feature to fix.

Flags:
  --dry-run      Analyze but do not perform changes.
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa fix "fix logger typo"
  nooa fix "implement new auth flow" --dry-run
`;

const fixCommand: Command = {
	name: "fix",
	description: "Autonomous bug fix loop",
	execute: async ({ rawArgs }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
				"dry-run": { type: "boolean" },
			},
			allowPositionals: true,
			strict: false,
		});

		if (values.help) {
			console.log(fixHelp);
			return;
		}

		const issue = positionals[1];
		if (!issue) {
			console.error("Error: Issue description required.");
			process.exitCode = 2;
			return;
		}

		if (!values.json) {
			console.log(`🔧 Starting autonomous fix for: "${issue}"...\n`);
		}

		const result = await runFix({
			issue,
			dryRun: values["dry-run"],
		});

		if (values.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			const { stages } = result;
			console.log(
				stages.worktree ? "✅ Worktree created" : "❌ Worktree failed",
			);
			console.log(
				stages.context ? "✅ Context built (Semantic)" : "❌ Context failed",
			);
			console.log(stages.patch ? "✅ Patch applied" : "❌ Patch failed");
			console.log(
				stages.verify
					? "✅ Verification (CI) passed"
					: "❌ Verification failed",
			);
			console.log(stages.commit ? "✅ Changes committed" : "❌ Commit skipped");

			if (result.ok) {
				console.log(`\n🎉 Fix complete! [Trace ID: ${result.traceId}]`);
			} else {
				console.error(`\n❌ Fix failed: ${result.error || "unknown error"}`);
			}
		}

		process.exitCode = result.ok ? 0 : 1;
	},
};

export default fixCommand;
