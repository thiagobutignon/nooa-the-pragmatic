import type { MemoryConfidence, MemoryEntry, MemoryScope, MemoryType } from "../core/memory/schema";
import { MemoryEngine } from "../features/memory/engine";
import { summarizeMemory } from "../features/memory/summarize";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface MemoryAddInput {
	content?: string;
	type?: MemoryType;
	scope?: MemoryScope;
	confidence?: MemoryConfidence;
	tags?: string[];
	traceId?: string;
	cwd?: string;
}

export interface MemorySearchInput {
	query?: string;
	semantic?: boolean;
	cwd?: string;
}

export interface MemoryIdInput {
	id?: string;
	cwd?: string;
}

export interface MemoryUpdateInput extends MemoryIdInput {
	content?: string;
}

export interface MemoryExportInput {
	path?: string;
	cwd?: string;
}

export interface MemoryImportInput {
	path?: string;
	cwd?: string;
}

export interface MemoryClearInput {
	force?: boolean;
	cwd?: string;
}

export interface MemoryListResult {
	entries: MemoryEntry[];
}

function engineFor(cwd?: string) {
	return new MemoryEngine(cwd ?? process.cwd());
}

export async function add(
	input: MemoryAddInput,
): Promise<SdkResult<{ ok: boolean; entry: MemoryEntry }>> {
	if (!input.content) {
		return { ok: false, error: sdkError("invalid_input", "content is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		const entry = await engine.addEntry({
			content: input.content,
			type: input.type ?? "fact",
			scope: input.scope ?? "repo",
			confidence: input.confidence ?? "medium",
			tags: input.tags ?? [],
			sources: [],
			trace_id: input.traceId,
		});
		return { ok: true, data: { ok: true, entry } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory add failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function remove(
	input: MemoryIdInput,
): Promise<SdkResult<{ ok: boolean; id: string }>> {
	if (!input.id) {
		return { ok: false, error: sdkError("invalid_input", "id is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		await engine.deleteEntry(input.id);
		return { ok: true, data: { ok: true, id: input.id } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory delete failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function update(
	input: MemoryUpdateInput,
): Promise<SdkResult<{ ok: boolean; id: string }>> {
	if (!input.id || !input.content) {
		return {
			ok: false,
			error: sdkError("invalid_input", "id and content are required.", {
				fields: [!input.id ? "id" : null, !input.content ? "content" : null].filter(Boolean),
			}),
		};
	}
	try {
		const engine = engineFor(input.cwd);
		await engine.updateEntry(input.id, input.content);
		return { ok: true, data: { ok: true, id: input.id } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory update failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function clear(
	input: MemoryClearInput = {},
): Promise<SdkResult<{ ok: boolean }>> {
	if (!input.force) {
		return {
			ok: false,
			error: sdkError("validation_error", "Use force to clear all memory."),
		};
	}
	try {
		const engine = engineFor(input.cwd);
		await engine.clearAll();
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory clear failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function exportData(
	input: MemoryExportInput,
): Promise<SdkResult<{ ok: boolean; path: string }>> {
	if (!input.path) {
		return { ok: false, error: sdkError("invalid_input", "path is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		await engine.exportData(input.path);
		return { ok: true, data: { ok: true, path: input.path } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory export failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function importData(
	input: MemoryImportInput,
): Promise<SdkResult<{ ok: boolean; path: string }>> {
	if (!input.path) {
		return { ok: false, error: sdkError("invalid_input", "path is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		await engine.importData(input.path);
		return { ok: true, data: { ok: true, path: input.path } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory import failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function promote(
	input: MemoryIdInput,
): Promise<SdkResult<{ ok: boolean; id: string }>> {
	if (!input.id) {
		return { ok: false, error: sdkError("invalid_input", "id is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		await engine.promoteEntry(input.id);
		return { ok: true, data: { ok: true, id: input.id } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory promote failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function search(
	input: MemorySearchInput,
): Promise<SdkResult<MemoryListResult>> {
	if (!input.query && input.query !== "") {
		return { ok: false, error: sdkError("invalid_input", "query is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		const entries = await engine.search(input.query, {
			semantic: Boolean(input.semantic),
		});
		return { ok: true, data: { entries } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory search failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function list(
	input: { cwd?: string } = {},
): Promise<SdkResult<MemoryListResult>> {
	try {
		const engine = engineFor(input.cwd);
		const entries = await engine.search("", { semantic: false });
		entries.sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);
		return { ok: true, data: { entries } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory list failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function get(
	input: MemoryIdInput,
): Promise<SdkResult<{ entry: MemoryEntry }>> {
	if (!input.id) {
		return { ok: false, error: sdkError("invalid_input", "id is required.") };
	}
	try {
		const engine = engineFor(input.cwd);
		const entry = await engine.getEntryById(input.id);
		if (!entry) {
			return {
				ok: false,
				error: sdkError("not_found", `Memory entry ${input.id} not found.`),
			};
		}
		return { ok: true, data: { entry } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory get failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function summarize(
	input: { cwd?: string } = {},
): Promise<SdkResult<{ ok: boolean; path: string }>> {
	try {
		const path = await summarizeMemory(input.cwd ?? process.cwd());
		return { ok: true, data: { ok: true, path } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Memory summarize failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const memory = {
	add,
	remove,
	update,
	clear,
	export: exportData,
	import: importData,
	promote,
	search,
	list,
	get,
	summarize,
};
