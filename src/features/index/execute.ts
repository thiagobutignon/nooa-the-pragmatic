import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { store } from "../../core/db";
import { createTraceId } from "../../core/logger";
import { AiEngine } from "../ai/engine";
import { MockProvider } from "../ai/providers/mock";
import { OllamaProvider } from "../ai/providers/ollama";
import { OpenAiProvider } from "../ai/providers/openai";

const ai = new AiEngine();
ai.register(new OllamaProvider());
ai.register(new OpenAiProvider());
ai.register(new MockProvider());

export async function indexRepo(root: string = ".") {
	const traceId = createTraceId();
	const files = await listFiles(root);
	let totalChunks = 0;

	for (const file of files) {
		const relPath = relative(root, file);
		const result = await indexFile(file, relPath);
		totalChunks += result.chunks;
	}

	return { traceId, files: files.length, totalChunks };
}

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const res = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (["node_modules", ".git", ".worktrees", "dist"].includes(entry.name))
					return [];
				return listFiles(res);
			}
			return res.endsWith(".ts") || res.endsWith(".md") ? [res] : [];
		}),
	);
	return files.flat();
}

export async function indexFile(fullPath: string, relPath: string) {
	const content = await readFile(fullPath, "utf-8");
	const chunks = chunkText(content);

	for (const chunk of chunks) {
		const res = await ai.embed({ input: chunk });
		if (res.embeddings[0]) {
			await store.storeEmbedding(relPath, chunk, res.embeddings[0]);
		}
	}

	return { path: relPath, chunks: chunks.length };
}

export async function executeSearch(query: string, limit = 5) {
	const res = await ai.embed({ input: query });
	if (!res.embeddings[0]) return [];

	const results = await store.searchEmbeddings(res.embeddings[0], limit);
	return results.map((r) => ({
		path: r.path,
		chunk: r.chunk,
		score: r.score,
	}));
}

export async function clearIndex() {
	await store.clear();
}

export async function getIndexStats() {
	return await store.stats();
}

export async function rebuildIndex(root: string = ".") {
	await clearIndex();
	return await indexRepo(root);
}

type ChunkOptions = {
	maxChars?: number;
	overlapLines?: number;
};

const DEFAULT_CHUNK_OPTIONS: Required<ChunkOptions> = {
	maxChars: 1000,
	overlapLines: 3,
};

const BOUNDARY_PATTERNS = [
	/^\s*export\s+(function|class|const)\b/i,
	/^\s*function\s+\w+\s*\(/i,
	/^\s*class\s+\w+/i,
	/^\s*#\s+\S+/,
];

function hasBoundaryMarkers(lines: string[]) {
	return lines.some((line) => BOUNDARY_PATTERNS.some((pattern) => pattern.test(line)));
}

function chunkLinesBySize(
	lines: string[],
	options: Required<ChunkOptions>,
): string[] {
	const chunks: string[] = [];
	let current: string[] = [];
	let currentSize = 0;

	for (const line of lines) {
		const nextSize = currentSize + line.length + 1;
		if (current.length > 0 && nextSize > options.maxChars) {
			chunks.push(current.join("\n"));
			const overlap =
				options.overlapLines > 0
					? current.slice(-options.overlapLines)
					: [];
			current = [...overlap];
			currentSize = current.join("\n").length;
		}
		current.push(line);
		currentSize += line.length + 1;
	}

	if (current.length > 0) {
		chunks.push(current.join("\n"));
	}

	return chunks.filter((chunk) => chunk.trim().length > 0);
}

function chunkLinesByBoundaries(
	lines: string[],
	options: Required<ChunkOptions>,
): string[] {
	const boundaries: number[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		if (BOUNDARY_PATTERNS.some((pattern) => pattern.test(lines[i] ?? ""))) {
			boundaries.push(i);
		}
	}
	if (boundaries.length === 0) return chunkLinesBySize(lines, options);

	const segments: string[][] = [];
	for (let i = 0; i < boundaries.length; i += 1) {
		const start = boundaries[i];
		const end = boundaries[i + 1] ?? lines.length;
		const segment = lines.slice(start, end);
		if (segment.length > 0) segments.push(segment);
	}

	const chunks: string[] = [];
	let previous: string[] = [];

	for (const segment of segments) {
		const segmentChunks =
			segment.join("\n").length > options.maxChars
				? chunkLinesBySize(segment, options)
				: [segment.join("\n")];
		for (const chunk of segmentChunks) {
			const chunkLines = chunk.split("\n");
			const overlap =
				options.overlapLines > 0
					? previous.slice(-options.overlapLines)
					: [];
			const combined = [...overlap, ...chunkLines].join("\n").trim();
			if (combined.length > 0) chunks.push(combined);
			previous = chunkLines;
		}
	}

	return chunks;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
	const resolved = {
		...DEFAULT_CHUNK_OPTIONS,
		...options,
	};
	const lines = text.split("\n");
	if (lines.length === 0) return [];
	if (hasBoundaryMarkers(lines)) {
		return chunkLinesByBoundaries(lines, resolved);
	}
	return chunkLinesBySize(lines, resolved);
}
