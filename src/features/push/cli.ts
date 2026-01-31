import type { Command, CommandContext } from "../../core/command";

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

		console.log(pushHelp);
		process.exitCode = 2;
	},
};

export default pushCommand;
