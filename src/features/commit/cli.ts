import type { Command, CommandContext } from "../../core/command";

const commitHelp = `
Usage: nooa commit -m <message> [flags]

Flags:
  --no-test      Skip tests
  --allow-todo   Allow TODO/MOCK markers
  -h, --help     Show help
`;

const commitCommand: Command = {
	name: "commit",
	execute: async ({ rawArgs }: CommandContext) => {
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

		console.log(commitHelp);
		process.exitCode = 2;
	},
};

export default commitCommand;
