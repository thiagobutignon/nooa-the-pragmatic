import { executeSearch } from "../features/index/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface AskRunInput {
	query?: string;
	limit?: number;
}

export interface AskResult {
	path: string;
	chunk: string;
	score: number;
}

export async function run(input: AskRunInput): Promise<SdkResult<AskResult[]>> {
	if (!input.query?.trim()) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Query required.", {
				field: "query",
			}),
		};
	}

	try {
		const limit = input.limit ?? 5;
		const results = await executeSearch(input.query, limit);
		return { ok: true, data: results };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ask_error", "Search failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const ask = {
	run,
};
