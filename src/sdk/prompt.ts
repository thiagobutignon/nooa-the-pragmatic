import { join } from "node:path";
import {
	createPrompt,
	deletePrompt,
	editPrompt,
	publishPrompt,
} from "../features/prompt/service";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface PromptBaseInput {
	templatesDir?: string;
}

export interface PromptCreateInput extends PromptBaseInput {
	name?: string;
	description?: string;
	output?: "json" | "markdown";
	body?: string;
}

export interface PromptEditInput extends PromptBaseInput {
	name?: string;
	patch?: string;
}

export interface PromptDeleteInput extends PromptBaseInput {
	name?: string;
}

export interface PromptPublishInput extends PromptBaseInput {
	name?: string;
	level?: "patch" | "minor" | "major";
	changelogPath?: string;
	note?: string;
}

function defaultTemplatesDir() {
	return join(process.cwd(), "src/features/prompt/templates");
}

function defaultChangelogPath() {
	return join(process.cwd(), "src/features/prompt/CHANGELOG.md");
}

export async function create(
	input: PromptCreateInput,
): Promise<SdkResult<{ ok: true }>> {
	if (!input.name || !input.description || !input.body) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name, description, and body are required.")
		};
	}
	try {
		await createPrompt({
			templatesDir: input.templatesDir ?? defaultTemplatesDir(),
			name: input.name,
			description: input.description,
			output: input.output,
			body: input.body,
		});
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("prompt_error", "Create prompt failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function edit(
	input: PromptEditInput,
): Promise<SdkResult<{ ok: true }>> {
	if (!input.name || !input.patch) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name and patch are required.")
		};
	}
	try {
		await editPrompt({
			templatesDir: input.templatesDir ?? defaultTemplatesDir(),
			name: input.name,
			patch: input.patch,
		});
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("prompt_error", "Edit prompt failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function remove(
	input: PromptDeleteInput,
): Promise<SdkResult<{ ok: true }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name is required.")
		};
	}
	try {
		await deletePrompt({
			templatesDir: input.templatesDir ?? defaultTemplatesDir(),
			name: input.name,
		});
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("prompt_error", "Delete prompt failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function publish(
	input: PromptPublishInput,
): Promise<SdkResult<{ version: string }>> {
	if (!input.name || !input.level || !input.note) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name, level, and note are required.")
		};
	}
	try {
		const version = await publishPrompt({
			templatesDir: input.templatesDir ?? defaultTemplatesDir(),
			name: input.name,
			level: input.level,
			changelogPath: input.changelogPath ?? defaultChangelogPath(),
			note: input.note,
		});
		return { ok: true, data: { version } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("prompt_error", "Publish prompt failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const prompt = {
	create,
	edit,
	remove,
	publish,
};
