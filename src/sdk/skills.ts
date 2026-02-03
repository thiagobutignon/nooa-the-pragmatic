import { join } from "node:path";
import type { Skill } from "../features/skills/manager";
import { SkillManager } from "../features/skills/manager";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface SkillsRootInput {
	rootDir?: string;
	cwd?: string;
}

export interface SkillNameInput extends SkillsRootInput {
	name?: string;
}

export interface SkillAddInput extends SkillNameInput {
	description?: string;
}

function resolveRoot(input?: SkillsRootInput): string {
	if (input?.rootDir) return input.rootDir;
	return join(input?.cwd ?? process.cwd(), ".agent/skills");
}

export async function list(
	input: SkillsRootInput = {},
): Promise<SdkResult<Skill[]>> {
	try {
		const manager = new SkillManager(resolveRoot(input));
		const skills = await manager.listSkills();
		return { ok: true, data: skills };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to list skills.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function add(
	input: SkillAddInput,
): Promise<SdkResult<{ ok: boolean; name: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required."),
		};
	}
	try {
		const manager = new SkillManager(resolveRoot(input));
		await manager.createSkill(input.name, input.description ?? "No description provided.");
		return { ok: true, data: { ok: true, name: input.name } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to create skill.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function remove(
	input: SkillNameInput,
): Promise<SdkResult<{ ok: boolean; name: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required."),
		};
	}
	try {
		const manager = new SkillManager(resolveRoot(input));
		await manager.deleteSkill(input.name);
		return { ok: true, data: { ok: true, name: input.name } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to remove skill.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function show(
	input: SkillNameInput,
): Promise<SdkResult<{ name: string; description: string; content: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required."),
		};
	}
	try {
		const manager = new SkillManager(resolveRoot(input));
		const skill = await manager.showSkill(input.name);
		return { ok: true, data: skill };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to read skill.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function enable(
	input: SkillNameInput,
): Promise<SdkResult<{ ok: boolean; name: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required."),
		};
	}
	try {
		const manager = new SkillManager(resolveRoot(input));
		await manager.enableSkill(input.name);
		return { ok: true, data: { ok: true, name: input.name } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to enable skill.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function disable(
	input: SkillNameInput,
): Promise<SdkResult<{ ok: boolean; name: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required."),
		};
	}
	try {
		const manager = new SkillManager(resolveRoot(input));
		await manager.disableSkill(input.name);
		return { ok: true, data: { ok: true, name: input.name } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to disable skill.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function update(
	input: SkillNameInput,
): Promise<SdkResult<{ ok: boolean; name: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required."),
		};
	}
	try {
		const manager = new SkillManager(resolveRoot(input));
		await manager.updateSkill(input.name);
		return { ok: true, data: { ok: true, name: input.name } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to update skill.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const skills = {
	list,
	add,
	remove,
	show,
	enable,
	disable,
	update,
};
