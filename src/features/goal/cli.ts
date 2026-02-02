import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import { clearGoal, getGoal, setGoal } from "./execute";

const goalHelp = `
Usage: nooa goal <subcommand> [flags]

Manage focus and prevent scope creep.

Subcommands:
  set <goal>     Set the current goal.
  status         Show current goal.
  clear          Clear the current goal.

Flags:
  --json         Output as JSON.
  -h, --help     Show help.
`;

const goalCommand: Command = {
	name: "goal",
	description: "Manage focus and goals",
	execute: async ({ rawArgs }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
			},
			allowPositionals: true,
			strict: false,
		});
		if (values.help) {
			console.log(goalHelp);
			return;
		}

		const sub = positionals[1];

		if (sub === "set") {
			const goal = positionals.slice(2).join(" ");
			if (!goal) {
				console.error("Error: Goal text required");
				process.exitCode = 2;
				return;
			}
			await setGoal(goal);
			console.log(`✅ Goal set: ${goal}`);
		} else if (sub === "status") {
			const goal = await getGoal();
			if (values.json) {
				console.log(JSON.stringify({ goal: goal || null }));
			} else {
				console.log(goal || "No goal set. Use `nooa goal set <goal>`");
			}
		} else if (sub === "clear") {
			await clearGoal();
			console.log("✅ Goal cleared");
		} else {
			console.log(goalHelp);
		}
	},
};

export default goalCommand;
