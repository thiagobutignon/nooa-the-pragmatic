import {
	addPattern,
	checkPathIgnored,
	loadIgnore,
	matchesPattern,
	removePattern,
	saveIgnore,
} from "../features/ignore/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface IgnorePatternInput {
	pattern?: string;
	cwd?: string;
}

export interface IgnoreCheckInput {
	path?: string;
	cwd?: string;
}

export interface IgnoreSaveInput {
	patterns?: string[];
	cwd?: string;
}

export async function list(
	input: { cwd?: string } = {},
): Promise<SdkResult<string[]>> {
	try {
		const patterns = await loadIgnore(input.cwd);
		return { ok: true, data: patterns };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ignore_error", "Failed to load ignore patterns.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function add(
	input: IgnorePatternInput,
): Promise<SdkResult<{ added: boolean }>> {
	if (!input.pattern) {
		return {
			ok: false,
			error: sdkError("invalid_input", "pattern is required.")
		};
	}
	try {
		const added = await addPattern(input.pattern, input.cwd);
		return { ok: true, data: { added } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ignore_error", "Failed to add pattern.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function remove(
	input: IgnorePatternInput,
): Promise<SdkResult<{ removed: boolean }>> {
	if (!input.pattern) {
		return {
			ok: false,
			error: sdkError("invalid_input", "pattern is required.")
		};
	}
	try {
		const removed = await removePattern(input.pattern, input.cwd);
		return { ok: true, data: { removed } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ignore_error", "Failed to remove pattern.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function check(
	input: IgnoreCheckInput,
): Promise<SdkResult<{ ignored: boolean; pattern?: string }>> {
	if (!input.path) {
		return {
			ok: false,
			error: sdkError("invalid_input", "path is required.")
		};
	}
	try {
		const result = await checkPathIgnored(input.path, input.cwd);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ignore_error", "Failed to check ignore.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function test(
	input: IgnorePatternInput & { value?: string },
): Promise<SdkResult<{ matches: boolean }>> {
	if (!input.pattern || !input.value) {
		return {
			ok: false,
			error: sdkError("invalid_input", "pattern and value are required.")
		};
	}
	try {
		const matches = matchesPattern(input.pattern, input.value, input.cwd);
		return { ok: true, data: { matches } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ignore_error", "Failed to test pattern.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function save(
	input: IgnoreSaveInput,
): Promise<SdkResult<{ saved: boolean }>> {
	if (!input.patterns) {
		return {
			ok: false,
			error: sdkError("invalid_input", "patterns are required.")
		};
	}
	try {
		await saveIgnore(input.patterns, input.cwd);
		return { ok: true, data: { saved: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ignore_error", "Failed to save patterns.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const ignore = {
	list,
	add,
	remove,
	check,
	test,
	save,
};
