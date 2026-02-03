import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Store } from "./index";

describe("Store", () => {
	let store: Store;

	beforeEach(() => {
		store = new Store(":memory:");
	});

	afterEach(() => {
		store.close();
	});

	test("initializes tables", async () => {
		const stats = await store.stats();
		expect(stats.chunks).toBe(0);
		expect(stats.documents).toBe(0);
	});

	test("stores and searches embeddings", async () => {
		const path = "doc1.txt";
		const chunk = "hello world";
		const vector = [1.0, 0.0, 0.0];

		await store.storeEmbedding(path, chunk, vector);

		const stats = await store.stats();
		expect(stats.chunks).toBe(1);
		expect(stats.documents).toBe(1);

		// Exact match search
		const results = await store.searchEmbeddings([1.0, 0.0, 0.0]);
		expect(results.length).toBe(1);
		expect(results[0].path).toBe(path);
		expect(results[0].score).toBeGreaterThan(0.99);
	});

	test("cosine similarity works", async () => {
		const v1 = [1.0, 0.0];
		const v2 = [0.0, 1.0]; // Orthogonal, sim = 0
		const v3 = [0.707, 0.707]; // 45 deg, sim ~ 0.707? No, dot (.707) / 1 = .707.

		await store.storeEmbedding("v1", "v1", v1);
		await store.storeEmbedding("v2", "v2", v2);
		await store.storeEmbedding("v3", "v3", v3);

		const results = await store.searchEmbeddings([1.0, 0.0], 3);
		// v1 should be first (score 1)
		// v3 should be second (score ~0.707)
		// v2 should be last (score 0)

		expect(results[0].path).toBe("v1");
		expect(results[1].path).toBe("v3");
		expect(results[2].path).toBe("v2");
		expect(results[2].score).toBeCloseTo(0);
	});

	test("handles zero vectors", async () => {
		await store.storeEmbedding("zero", "zero", [0, 0]);
		const results = await store.searchEmbeddings([1, 1]);
		expect(results[0].score).toBe(0);
	});

	test("handles dimension mismatch", async () => {
		// The implementation of cosineSimilarity checks length
		// But searchEmbeddings creates Float32Array from stored buffer.
		// If stored vector has diff length than query vector, math happens up to min length?
		// No, loop goes up to `a.length` (query vector).
		// If b is shorter, `b[i] ?? 0` handles it.

		await store.storeEmbedding("short", "short", [1]);
		const results = await store.searchEmbeddings([1, 1]);
		// dot = 1*1 + 1*0 = 1
		// mA = 2, mB = 1
		// sim = 1 / (1.414 * 1) =         expect(results[0].score).toBe(0);
	});

	test("updates embedding on conflict", async () => {
		await store.storeEmbedding("doc1", "v1", [1, 0]);
		await store.storeEmbedding("doc1", "v1", [0, 1]); // Same ID (since path:chunk is same)

		const stats = await store.stats();
		expect(stats.chunks).toBe(1);

		const results = await store.searchEmbeddings([0, 1]);
		expect(results[0].score).toBeCloseTo(1);
	});

	test("clear removes all", async () => {
		await store.storeEmbedding("doc1", "v1", [1, 0]);
		await store.clear();
		const stats = await store.stats();
		expect(stats.chunks).toBe(0);
	});
});
