import { join } from "node:path";
import type { Command, CommandContext } from "../../core/command";

const skillsHelp = `
Usage: nooa skills [subcommand] [flags]

Manage NOOA skills.

Subcommands:
  list                 List all available skills.
  add <name> [desc]    Create a new skill.
  remove <name>        Delete a skill.
  show <name>          Show skill details.
  enable <name>        Enable a skill.
  disable <name>       Disable a skill.
  update <name>        Update a skill.
`;

const skillsCommand: Command = {
	name: "skills",
	description: "Manage NOOA skills",
	execute: async ({ rawArgs }: CommandContext, injectedManager?: any) => {
		const { SkillManager } = await import("./manager");
		const manager =
			injectedManager || new SkillManager(join(process.cwd(), ".agent/skills"));

		const subcommand = rawArgs[0];
		const arg1 = rawArgs[1];
		const arg2 = rawArgs[2];

		if (subcommand === "list") {
			const skills = await manager.listSkills();
			console.log("Current skills:");
			if (skills.length === 0) {
				console.log("  (none)");
			} else {
				for (const s of skills) {
					const status = s.enabled ? "enabled" : "disabled";
					console.log(`  - ${s.name} (${status}): ${s.description}`);
				}
			}
			return;
		}

		if (subcommand === "add") {
			if (!arg1) {
				console.error("Error: Skill name required.");
				process.exitCode = 1;
				return;
			}
			const description = arg2 || "No description provided.";
			await manager.createSkill(arg1, description);
			console.log(`Skill '${arg1}' created.`);
			return;
		}

		if (subcommand === "remove") {
			if (!arg1) {
				console.error("Error: Skill name required.");
				process.exitCode = 1;
				return;
			}
			await manager.deleteSkill(arg1);
			console.log(`Skill '${arg1}' removed.`);
			return;
		}

		if (subcommand === "enable") {
			if (!arg1) {
				console.error("Error: Skill name required.");
				process.exitCode = 1;
				return;
			}
			await manager.enableSkill(arg1);
			console.log(`Skill '${arg1}' enabled.`);
			return;
		}

		if (subcommand === "disable") {
			if (!arg1) {
				console.error("Error: Skill name required.");
				process.exitCode = 1;
				return;
			}
			await manager.disableSkill(arg1);
			console.log(`Skill '${arg1}' disabled.`);
			return;
		}

		if (subcommand === "show") {
			if (!arg1) {
				console.error("Error: Skill name required.");
				process.exitCode = 1;
				return;
			}
			const skill = await manager.showSkill(arg1);
			console.log(`Name: ${skill.name}`);
			console.log(`Description: ${skill.description}`);
			console.log("\nContent:\n");
			console.log(skill.content);
			return;
		}

		if (subcommand === "update") {
			if (!arg1) {
				console.error("Error: Skill name required.");
				process.exitCode = 1;
				return;
			}
			await manager.updateSkill(arg1);
			console.log(`Skill '${arg1}' updated successfully.`);
			return;
		}

		console.log(skillsHelp);
	},
};

export default skillsCommand;
