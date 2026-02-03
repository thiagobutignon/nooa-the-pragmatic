import { relative } from "node:path";
import {
	clearIndex,
	executeSearch,
	getIndexStats,
	indexFile,
	indexRepo,
	rebuildIndex,
} from "../features/index/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface IndexBuildInput {
	root?: string;
}

export interface IndexFileInput {
	fullPath?: string;
	root?: string;
}

export interface IndexSearchInput {
	query?: string;
	limit?: number;
}

export async function build(
	input: IndexBuildInput = {},
): Promise<SdkResult<Awaited<ReturnType<typeof indexRepo>>>> {
	try {
		const result = await indexRepo(input.root ?? ".");
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("index_error", "Index build failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function file(
	input: IndexFileInput,
): Promise<SdkResult<Awaited<ReturnType<typeof indexFile>>>> {
	if (!input.fullPath) {
		return {
			ok: false,
			error: sdkError("invalid_input", "fullPath is required.")
		};
	}
	try {
		const relPath = input.root
			? relative(input.root, input.fullPath)
			: input.fullPath;
		const result = await indexFile(input.fullPath, relPath);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("index_error", "Index file failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function search(
	input: IndexSearchInput,
): Promise<SdkResult<Awaited<ReturnType<typeof executeSearch>>>> {
	if (!input.query) {
		return {
			ok: false,
			error: sdkError("invalid_input", "query is required.")
		};
	}
	try {
		const result = await executeSearch(input.query, input.limit ?? 5);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("index_error", "Search failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function clear(): Promise<SdkResult<null>> {
	try {
		await clearIndex();
		return { ok: true, data: null };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("index_error", "Clear index failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function stats(): Promise<SdkResult<Awaited<ReturnType<typeof getIndexStats>>>> {
	try {
		const result = await getIndexStats();
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("index_error", "Stats failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function rebuild(
	input: IndexBuildInput = {},
): Promise<SdkResult<Awaited<ReturnType<typeof rebuildIndex>>>> {
	try {
		const result = await rebuildIndex(input.root ?? ".");
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("index_error", "Rebuild index failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const indexSdk = {
	build,
	file,
	search,
	clear,
	stats,
	rebuild,
};
