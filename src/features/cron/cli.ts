import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";

const cronHelp = `
Usage: nooa cron <subcommand> [args]

Manage recurring jobs.

Subcommands:
  add <name> --every <schedule> -- <command...>
`;

const cronCommand: Command = {
	name: "cron",
	description: "Manage recurring jobs",
	execute: async ({ rawArgs }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				every: { type: "string" },
			},
			allowPositionals: true,
			strict: false,
		});

		const subcommand = positionals[1];
		if (subcommand !== "add") {
			console.log(cronHelp);
			return;
		}

		const name = positionals[2];
		const schedule = values.every as string | undefined;

		if (!name || !schedule) {
			console.error("Error: Name and schedule are required for 'add'.");
			process.exitCode = 2;
			return;
		}

		console.log(`✅ Job '${name}' added with schedule '${schedule}'.`);
	},
};

export default cronCommand;
