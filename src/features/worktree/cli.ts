import type { Command } from "../../core/command";

const worktreeHelp = `
Usage: nooa worktree <branch> [flags]

Flags:
  --base <branch>   Base branch (default: main)
  --no-install      Skip dependency install
  --no-test         Skip tests
  -h, --help        Show help
`;

const worktreeCommand: Command = {
	name: "worktree",
	execute: async ({ values }) => {
		if (values.help) {
			console.log(worktreeHelp);
			return;
		}
		console.log(worktreeHelp);
		process.exitCode = 2;
	},
};

export default worktreeCommand;
