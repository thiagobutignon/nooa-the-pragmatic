import { readFile, writeFile } from "node:fs/promises";
import { AiEngine } from "../features/ai/engine";
import { MockProvider, OllamaProvider, OpenAiProvider } from "../features/ai/providers/mod";
import { executeDiff } from "../features/code/diff";
import { executeFormat } from "../features/code/format";
import { applyPatch } from "../features/code/patch";
import { executeRefactor } from "../features/code/refactor";
import type { WriteCodeInput, WriteCodeResult } from "../features/code/write";
import { writeCodeFile } from "../features/code/write";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export type CodeWriteInput = WriteCodeInput;
export type CodeWriteResult = WriteCodeResult;

export interface CodePatchInput {
	path: string;
	patch: string;
	dryRun?: boolean;
}

export interface CodePatchResult {
	path: string;
	bytes: number;
	patched: boolean;
}

export interface CodeDiffInput {
	path?: string;
}

export interface CodeFormatInput {
	path: string;
}

export interface CodeRefactorInput {
	path: string;
	instructions: string;
	engine?: Pick<AiEngine, "complete">;
}

function createDefaultEngine() {
	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new MockProvider());
	return engine;
}

export async function write(
	input: CodeWriteInput,
): Promise<SdkResult<CodeWriteResult>> {
	try {
		const result = await writeCodeFile(input);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("code_write_error", "Code write failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function patch(
	input: CodePatchInput,
): Promise<SdkResult<CodePatchResult>> {
	try {
		const original = await readFile(input.path, "utf-8");
		const content = applyPatch(original, input.patch);
		if (!input.dryRun) {
			await writeFile(input.path, content, "utf-8");
		}
		return {
			ok: true,
			data: {
				path: input.path,
				bytes: Buffer.byteLength(content),
				patched: true,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: sdkError("code_patch_error", "Code patch failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function diff(
	input: CodeDiffInput = {},
): Promise<SdkResult<string>> {
	try {
		const result = await executeDiff(input.path);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("code_diff_error", "Code diff failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function format(
	input: CodeFormatInput,
): Promise<SdkResult<string>> {
	if (!input.path) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Path is required.", {
				field: "path",
			}),
		};
	}
	try {
		const result = await executeFormat(input.path);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("code_format_error", "Code format failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function refactor(
	input: CodeRefactorInput,
): Promise<SdkResult<string>> {
	if (!input.path || !input.instructions) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Path and instructions are required.", {
				field: !input.path ? "path" : "instructions",
			}),
		};
	}
	try {
		const engine = input.engine ?? createDefaultEngine();
		const result = await executeRefactor(
			input.path,
			input.instructions,
			engine,
		);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("code_refactor_error", "Code refactor failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const code = {
	write,
	patch,
	diff,
	format,
	refactor,
};
