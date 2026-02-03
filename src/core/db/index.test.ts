import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Store } from "./index";

describe("Store Core", () => {
	let store: Store;

	beforeEach(() => {
		// Initialize with in-memory DB for isolation
		store = new Store(":memory:");
	});

	afterEach(() => {
		store.close();
	});
	test("stats() returns valid counts", async () => {
		// Initially empty
		// @ts-expect-error
		let stats = await store.stats();
		expect(stats.documents).toBe(0);
		expect(stats.chunks).toBe(0);

		// Add some data
		await store.storeEmbedding("doc1.md", "chunk1", [0.1, 0.2]);
		await store.storeEmbedding("doc1.md", "chunk2", [0.3, 0.4]);

		// @ts-expect-error
		stats = await store.stats();
		expect(stats.documents).toBe(1); // Distinct paths
		expect(stats.chunks).toBe(2);
	});

	test("clear() removes all embeddings", async () => {
		await store.storeEmbedding("doc1.md", "chunk1", [0.1, 0.2]);
		// @ts-expect-error database stats are provided at runtime
		let stats = await store.stats();
		expect(stats.chunks).toBe(1);

		// @ts-expect-error database stats are provided at runtime
		await store.clear();
		// @ts-expect-error database stats are provided at runtime
		stats = await store.stats();
		expect(stats.chunks).toBe(0);
		expect(stats.documents).toBe(0);
	});

	test("searchEmbeddings returns matches sorted by similarity", async () => {
		await store.storeEmbedding("doc1.md", "up", [0.0, 1.0]);
		await store.storeEmbedding("doc1.md", "right", [1.0, 0.0]);
		await store.storeEmbedding("doc2.md", "diagonal", [
			Math.SQRT1_2,
			Math.SQRT1_2,
		]);

		const results = await store.searchEmbeddings([0.1, 0.9], 2);
		expect(results.length).toBe(2);
		expect(results[0]?.chunk).toBe("up");
		expect(results[1]?.chunk).toBe("diagonal");
	});

	test("cosineSimilarity handles zero vectors and dimension mismatch", async () => {
		// Use private method via any cast for edge cases
		const s = store as any;

		// Zero vector
		expect(
			s.cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1])),
		).toBe(0);

		// Dimension mismatch
		expect(
			s.cosineSimilarity(new Float32Array([1]), new Float32Array([1, 1])),
		).toBe(0);
	});
});
