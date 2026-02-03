import { readFile } from "node:fs/promises";
import { embedText } from "../features/embed/engine";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface EmbedTextInput {
	text?: string;
	provider?: string;
	model?: string;
	endpoint?: string;
	apiKey?: string;
}

export interface EmbedFileInput {
	path?: string;
	provider?: string;
	model?: string;
	endpoint?: string;
	apiKey?: string;
}

export async function text(
	input: EmbedTextInput,
): Promise<SdkResult<Awaited<ReturnType<typeof embedText>>>> {
	if (!input.text) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Text is required.", {
				field: "text",
			}),
		};
	}
	try {
		const result = await embedText(input.text, {
			provider: input.provider,
			model: input.model,
			endpoint: input.endpoint,
			apiKey: input.apiKey,
		});
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("embed_error", "Embedding failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function file(
	input: EmbedFileInput,
): Promise<SdkResult<Awaited<ReturnType<typeof embedText>>>> {
	if (!input.path) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Path is required.", {
				field: "path",
			}),
		};
	}
	try {
		const content = await readFile(input.path, "utf-8");
		const result = await embedText(content, {
			provider: input.provider,
			model: input.model,
			endpoint: input.endpoint,
			apiKey: input.apiKey,
		});
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("embed_error", "Embedding failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const embed = {
	text,
	file,
};
