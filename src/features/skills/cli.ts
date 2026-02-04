import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	setExitCode
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { SkillManager } from "./manager";

export type SkillsAction =
	| "list"
	| "add"
	| "remove"
	| "show"
	| "enable"
	| "disable"
	| "update"
	| "help";

export const skillsMeta: AgentDocMeta = {
	name: "skills",
	description: "Manage NOOA skills",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const skillsHelp = `
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

export const skillsSdkUsage = `
SDK Usage:
  await skills.run({ action: "list" });
  await skills.run({ action: "add", name: "my-skill", description: "..." });
`;

export const skillsUsage = {
	cli: "nooa skills [subcommand] [flags]",
	sdk: "await skills.run({ action: \"list\" })",
	tui: "SkillsPanel()",
};

export const skillsSchema = {
	action: { type: "string", required: true },
	name: { type: "string", required: false },
	description: { type: "string", required: false },
} satisfies SchemaSpec;

export const skillsOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "skills", type: "string" },
	{ name: "skill", type: "string" },
	{ name: "message", type: "string" },
];

export const skillsErrors = [
	{ code: "skills.missing_action", message: "Action is required." },
	{ code: "skills.missing_name", message: "Skill name required." },
	{ code: "skills.runtime_error", message: "Runtime error." },
];

export const skillsExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const skillsExamples = [
	{ input: "nooa skills list", output: "List skills" },
	{ input: "nooa skills add my-skill \"desc\"", output: "Create skill" },
];

export interface SkillsRunInput {
	action?: SkillsAction;
	name?: string;
	description?: string;
	manager?: SkillManager;
}

export interface SkillsRunResult {
	mode: SkillsAction;
	skills?: Array<{ name: string; description: string; enabled?: boolean }>;
	skill?: { name: string; description: string; content?: string };
	message?: string;
}

export async function run(
	input: SkillsRunInput,
): Promise<SdkResult<SkillsRunResult>> {
	const action = input.action;
	if (!action) {
		return {
			ok: false,
			error: sdkError("skills.missing_action", "Action is required."),
		};
	}

	const { SkillManager } = await import("./manager");
	const manager =
		input.manager || new SkillManager(join(process.cwd(), ".agent/skills"));

	if (action === "list") {
		const skills = await manager.listSkills();
		return { ok: true, data: { mode: "list", skills } };
	}

	if (action === "add") {
		if (!input.name) {
			return {
				ok: false,
				error: sdkError("skills.missing_name", "Skill name required."),
			};
		}
		const description = input.description || "No description provided.";
		await manager.createSkill(input.name, description);
		return {
			ok: true,
			data: { mode: "add", message: `Skill '${input.name}' created.` },
		};
	}

	if (action === "remove") {
		if (!input.name) {
			return {
				ok: false,
				error: sdkError("skills.missing_name", "Skill name required."),
			};
		}
		await manager.deleteSkill(input.name);
		return {
			ok: true,
			data: { mode: "remove", message: `Skill '${input.name}' removed.` },
		};
	}

	if (action === "enable") {
		if (!input.name) {
			return {
				ok: false,
				error: sdkError("skills.missing_name", "Skill name required."),
			};
		}
		await manager.enableSkill(input.name);
		return {
			ok: true,
			data: { mode: "enable", message: `Skill '${input.name}' enabled.` },
		};
	}

	if (action === "disable") {
		if (!input.name) {
			return {
				ok: false,
				error: sdkError("skills.missing_name", "Skill name required."),
			};
		}
		await manager.disableSkill(input.name);
		return {
			ok: true,
			data: { mode: "disable", message: `Skill '${input.name}' disabled.` },
		};
	}

	if (action === "show") {
		if (!input.name) {
			return {
				ok: false,
				error: sdkError("skills.missing_name", "Skill name required."),
			};
		}
		const skill = await manager.showSkill(input.name);
		return { ok: true, data: { mode: "show", skill } };
	}

	if (action === "update") {
		if (!input.name) {
			return {
				ok: false,
				error: sdkError("skills.missing_name", "Skill name required."),
			};
		}
		await manager.updateSkill(input.name);
		return {
			ok: true,
			data: { mode: "update", message: `Skill '${input.name}' updated.` },
		};
	}

	return { ok: true, data: { mode: "help" } };
}

const skillsBuilder = new CommandBuilder<SkillsRunInput, SkillsRunResult>()
	.meta(skillsMeta)
	.usage(skillsUsage)
	.schema(skillsSchema)
	.help(skillsHelp)
	.sdkUsage(skillsSdkUsage)
	.outputFields(skillsOutputFields)
	.examples(skillsExamples)
	.errors(skillsErrors)
	.exitCodes(skillsExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals }) => ({
		action: positionals[1] as SkillsAction | undefined,
		name: positionals[2],
		description: positionals[3],
	}))
	.run(run)
	.onSuccess((output) => {
		switch (output.mode) {
			case "list": {
				console.log("Current skills:");
				if (!output.skills || output.skills.length === 0) {
					console.log("  (none)");
				} else {
					for (const s of output.skills) {
						const status = s.enabled ? "enabled" : "disabled";
						console.log(`  - ${s.name} (${status}): ${s.description}`);
					}
				}
				return;
			}
			case "show": {
				if (!output.skill) return;
				console.log(`Name: ${output.skill.name}`);
				console.log(`Description: ${output.skill.description}`);
				console.log("\nContent:\n");
				if (output.skill.content) console.log(output.skill.content);
				return;
			}
			case "add":
			case "remove":
			case "enable":
			case "disable":
			case "update":
				if (output.message) console.log(output.message);
				return;
			default:
				console.log(skillsHelp);
		}
	})
	.onFailure((error) => {
		if (error.code === "skills.missing_action") {
			console.log(skillsHelp);
			setExitCode(error, ["skills.missing_action", "skills.missing_name"]);
			return;
		}
		handleCommandError(error, ["skills.missing_name"]);
	});

export const skillsAgentDoc = skillsBuilder.buildAgentDoc(false);
export const skillsFeatureDoc = (includeChangelog: boolean) =>
	skillsBuilder.buildFeatureDoc(includeChangelog);

export default skillsBuilder.build();
