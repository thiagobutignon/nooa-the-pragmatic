import { describe, test, expect, beforeEach, afterEach } from "bun:test";
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
        // @ts-ignore
        let stats = await store.stats();
        expect(stats.documents).toBe(0);
        expect(stats.chunks).toBe(0);

        // Add some data
        await store.storeEmbedding("doc1.md", "chunk1", [0.1, 0.2]);
        await store.storeEmbedding("doc1.md", "chunk2", [0.3, 0.4]);

        // @ts-ignore
        stats = await store.stats();
        expect(stats.documents).toBe(1); // Distinct paths
        expect(stats.chunks).toBe(2);
    });

    test("clear() removes all embeddings", async () => {
        await store.storeEmbedding("doc1.md", "chunk1", [0.1, 0.2]);
        // @ts-ignore
        let stats = await store.stats();
        expect(stats.chunks).toBe(1);

        // @ts-ignore
        await store.clear();
        // @ts-ignore
        stats = await store.stats();
        expect(stats.chunks).toBe(0);
        expect(stats.documents).toBe(0);
    });
});
