import type { Command, CommandContext } from "../../core/command";
import { ensureGitRepo, isWorkingTreeClean } from "./guards";

const pushHelp = `
Usage: nooa push [remote] [branch]

Flags:
  --no-test      Skip running tests before push
  -h, --help     Show help
`;

const pushCommand: Command = {
	name: "push",
	execute: async ({ rawArgs }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				"no-test": { type: "boolean" },
			},
			strict: true,
			allowPositionals: true,
		});

		if (values.help) {
			console.log(pushHelp);
			return;
		}

		const cwd = process.cwd();
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

		console.log(pushHelp);
		process.exitCode = 2;
	},
};

export default pushCommand;
