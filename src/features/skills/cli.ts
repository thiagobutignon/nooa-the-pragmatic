import type { Command, CommandContext } from "../../core/command";
import { Discovery } from "../../core/skills/Discovery";
import { join } from "node:path";

const skillsHelp = `
Usage: nooa skills [subcommand] [flags]

Manage NOOA skills.

Subcommands:
  list    List all available skills.
`;

const skillsCommand: Command = {
    name: "skills",
    description: "Manage NOOA skills",
    execute: async ({ rawArgs }: CommandContext) => {
        const subcommand = rawArgs[1];
        if (subcommand === "list") {
            const discovery = new Discovery(join(process.cwd(), ".agent/skills"));
            const list = await discovery.list();
            console.log("Current skills:");
            for (const s of list) console.log(`  - ${s}`);
            return;
        }
        console.log(skillsHelp);
    }
};

export default skillsCommand;
