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

function chunkText(text: string, size = 1000): string[] {
	// Simple paragraph-based chunking
	const paragraphs = text.split("\n\n");
	const chunks: string[] = [];
	let currentChunk = "";

	for (const p of paragraphs) {
		if (currentChunk.length + p.length > size && currentChunk.length > 0) {
			chunks.push(currentChunk.trim());
			currentChunk = "";
		}
		currentChunk += `${p}\n\n`;
	}
	if (currentChunk.trim().length > 0) {
		chunks.push(currentChunk.trim());
	}

	return chunks;
}
