import { runSearch, type SearchResult } from "../features/search/engine";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface SearchRunInput {
	query?: string;
	root?: string;
	regex?: boolean;
	caseSensitive?: boolean;
	filesOnly?: boolean;
	maxResults?: number;
	include?: string[];
	exclude?: string[];
	ignoreCase?: boolean;
	context?: number;
	count?: boolean;
	hidden?: boolean;
}

export interface SearchRunResult {
	results: SearchResult[];
	files?: string[];
	counts?: Record<string, number>;
}

export async function run(
	input: SearchRunInput,
): Promise<SdkResult<SearchRunResult>> {
	if (!input.query) {
		return {
			ok: false,
			error: sdkError("invalid_input", "query is required."),
		};
	}

	const root = input.root ?? ".";
	const maxResultsStr =
		input.maxResults?.toString() ?? process.env.NOOA_SEARCH_MAX_RESULTS ?? "100";
	const maxResults = Number.parseInt(maxResultsStr, 10);
	if (Number.isNaN(maxResults)) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Invalid maxResults value.", {
				maxResults: maxResultsStr,
			}),
		};
	}

	try {
		const results = await runSearch({
			query: input.query,
			root,
			regex: input.regex,
			maxResults,
			include: input.include,
			exclude: input.exclude,
			filesOnly: input.filesOnly,
			ignoreCase: input.ignoreCase,
			caseSensitive: input.caseSensitive,
			context: input.context,
			count: input.count,
			hidden: input.hidden,
		});

		const data: SearchRunResult = { results };

		if (input.filesOnly) {
			data.files = Array.from(new Set(results.map((r) => r.path)));
		}

		if (input.count) {
			const counts: Record<string, number> = {};
			for (const result of results) {
				counts[result.path] = result.matchCount ?? 0;
			}
			data.counts = counts;
		}

		return { ok: true, data };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Search failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const search = {
	run,
};
