import { describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { store } from "../../core/db";
import { AiEngine } from "../ai/engine";
import * as execute from "./execute";

describe("Index Feature Execution", () => {
	test("clearIndex calls store.clear", async () => {
		const spy = spyOn(store, "clear").mockResolvedValue(undefined as never);

		await execute.clearIndex();

		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	test("getIndexStats calls store.stats", async () => {
		const expected = { documents: 10, chunks: 20 };
		const spy = spyOn(store, "stats").mockResolvedValue(expected as any);

		const result = await execute.getIndexStats();

		expect(spy).toHaveBeenCalled();
		expect(result).toEqual(expected);
		spy.mockRestore();
	});

	test("indexRepo recursively lists and indexes files", async () => {
		const readdirSpy = spyOn(fs, "readdir").mockImplementation(
			async (path: any) => {
				if (path === ".")
					return [
						{ name: "a.ts", isDirectory: () => false },
						{ name: "dir", isDirectory: () => true },
					] as any;
				if (path === "dir")
					return [
						{ name: "b.md", isDirectory: () => false },
						{ name: "node_modules", isDirectory: () => true },
					] as any;
				return [];
			},
		);
		const readFileSpy = spyOn(fs, "readFile").mockResolvedValue(
			"content" as any,
		);
		const storeSpy = spyOn(store, "storeEmbedding").mockResolvedValue(
			undefined as never,
		);
		const _aiSpy = spyOn(AiEngine.prototype, "embed").mockResolvedValue({
			embeddings: [[0.1, 0.2]],
		} as any);

		const result = await execute.indexRepo(".");

		expect(result.files).toBe(2); // a.ts and dir/b.md
		expect(readdirSpy).toHaveBeenCalledTimes(2); // . and dir

		readdirSpy.mockRestore();
		readFileSpy.mockRestore();
		storeSpy.mockRestore();
	});

	test("executeSearch embeds query and searches store", async () => {
		const searchSpy = spyOn(store, "searchEmbeddings").mockResolvedValue([
			{ path: "a.ts", chunk: "c1", score: 0.9 },
		] as any);
		const _aiSpy = spyOn(AiEngine.prototype, "embed").mockResolvedValue({
			embeddings: [[0.1, 0.2]],
		} as any);

		const results = await execute.executeSearch("query");

		expect(results).toHaveLength(1);
		expect(results[0]?.path).toBe("a.ts");
		searchSpy.mockRestore();
	});

	test("rebuildIndex calls clear and indexRepo", async () => {
		const clearSpy = spyOn(store, "clear").mockResolvedValue(
			undefined as never,
		);
		const readdirSpy = spyOn(fs, "readdir").mockResolvedValue([] as any);

		await execute.rebuildIndex(".");

		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
		readdirSpy.mockRestore();
	});

	test("chunking logic with large text", async () => {
		const readFileSpy = spyOn(fs, "readFile").mockResolvedValue(
			"p1\n\np2" as any,
		);
		const storeSpy = spyOn(store, "storeEmbedding").mockResolvedValue(
			undefined as never,
		);

		const largeParagraph = "a".repeat(1100);
		readFileSpy.mockResolvedValue(
			`${largeParagraph}\n\n${largeParagraph}` as any,
		);
		const _aiSpy = spyOn(AiEngine.prototype, "embed").mockResolvedValue({
			embeddings: [[0.1, 0.2]],
		} as any);

		await execute.indexFile("test.ts", "test.ts");

		// Should split into multiple chunks
		expect(storeSpy.mock.calls.length).toBeGreaterThan(1);

		readFileSpy.mockRestore();
		storeSpy.mockRestore();
	});

	test("chunkText splits with overlap and respects line boundaries", () => {
		const input = Array.from({ length: 120 }, (_, i) => `line-${i}`).join("\n");
		const chunks = execute.chunkText(input, { maxChars: 200, overlapLines: 5 });
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]).toContain("line-0");
		const lastLine = chunks[0].trim().split("\n").slice(-1)[0];
		expect(chunks[1]).toContain(lastLine ?? "");
	});

	test("chunkText keeps top-level boundaries when markers exist", () => {
		const input = [
			"export function alpha() {}",
			"",
			"export function beta() {}",
			"",
			"export class Gamma {}",
		].join("\n");
		const chunks = execute.chunkText(input, { maxChars: 50, overlapLines: 2 });
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]).toContain("alpha");
		expect(chunks[1]).toContain("beta");
	});
});
