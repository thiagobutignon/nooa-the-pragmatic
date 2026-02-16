import { describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { AiEngine } from "../ai/engine";
import { chunkText, embedChunks, LruCache, listFiles } from "./execute";

describe("Index Execute Internals", () => {
	describe("LruCache", () => {
		test("stores and retrieves values", () => {
			const cache = new LruCache<string, number>(3);
			cache.set("a", 1);
			expect(cache.get("a")).toBe(1);
		});

		test("returns undefined for missing keys", () => {
			const cache = new LruCache<string, number>(3);
			expect(cache.get("b")).toBeUndefined();
		});

		test("evicts oldest item when max size exceeded", () => {
			const cache = new LruCache<string, number>(2);
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3); // Should evict 'a'

			expect(cache.get("a")).toBeUndefined();
			expect(cache.get("b")).toBe(2);
			expect(cache.get("c")).toBe(3);
		});

		test("updates recently used order on get", () => {
			const cache = new LruCache<string, number>(2);
			cache.set("a", 1);
			cache.set("b", 2);
			cache.get("a"); // 'a' is now most recent
			cache.set("c", 3); // Should evict 'b'

			expect(cache.get("b")).toBeUndefined();
			expect(cache.get("a")).toBe(1);
		});

		test("updates recently used order on set update", () => {
			const cache = new LruCache<string, number>(2);
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("a", 10); // 'a' is updated and most recent
			cache.set("c", 3); // Should evict 'b'

			expect(cache.get("b")).toBeUndefined();
			expect(cache.get("a")).toBe(10);
		});
	});

	describe("listFiles", () => {
		test("ignores specific directories", async () => {
			const readdirSpy = spyOn(fs, "readdir").mockResolvedValue([
				{ name: "node_modules", isDirectory: () => true },
				{ name: ".git", isDirectory: () => true },
				{ name: "dist", isDirectory: () => true },
				{ name: "src", isDirectory: () => true },
				{ name: "foo.ts", isDirectory: () => false },
			] as any);

			// We need to mock the recursive call behavior or just check that it calls readdir for src but not others
			// Since listFiles is recursive, mocking it is tricky if we want to test the recursion logic itself.
			// Instead we can mock readdir to return files for "src" on second call?
			// Simpler: mock readdir to return empty for "src" to stop recursion
			readdirSpy.mockImplementation(async (path: any) => {
				if (path === "root")
					return [
						{ name: "node_modules", isDirectory: () => true },
						{ name: "src", isDirectory: () => true },
						{ name: "foo.ts", isDirectory: () => false },
					] as any;
				if (path === "root/src")
					return [{ name: "bar.ts", isDirectory: () => false }] as any;
				return [];
			});

			const files = await listFiles("root");
			expect(files).toContain("root/foo.ts");
			expect(files).toContain("root/src/bar.ts");
			expect(files).not.toContain("root/node_modules");

			readdirSpy.mockRestore();
		});

		test("filters by extension", async () => {
			const readdirSpy = spyOn(fs, "readdir").mockResolvedValue([
				{ name: "a.ts", isDirectory: () => false },
				{ name: "b.md", isDirectory: () => false },
				{ name: "c.json", isDirectory: () => false },
			] as any);

			const files = await listFiles("root");
			expect(files).toContain("root/a.ts");
			expect(files).toContain("root/b.md");
			expect(files).not.toContain("root/c.json");

			readdirSpy.mockRestore();
		});
	});

	describe("embedChunks", () => {
		test("uses batch embedding when possible", async () => {
			const embedSpy = spyOn(AiEngine.prototype, "embed").mockResolvedValue({
				embeddings: [[0.1], [0.2], [0.3]],
			} as any);

			const chunks = ["a", "b", "c"];
			const results = await embedChunks(chunks);

			expect(results).toHaveLength(3);
			expect(results[0]?.chunk).toBe("a");
			expect(results[0]?.embedding).toEqual([0.1]);
			expect(embedSpy).toHaveBeenCalledTimes(1); // One batch call

			embedSpy.mockRestore();
		});

		test("falls back to individual embedding on batch mismatch", async () => {
			// Simulate batch returning wrong number of embeddings
			const embedSpy = spyOn(AiEngine.prototype, "embed")
				.mockResolvedValueOnce({
					embeddings: [[0.1]], // Only 1, but we sent 2
				} as any)
				.mockResolvedValue({
					embeddings: [[0.5]],
				} as any); // Subsequent calls

			const chunks = ["a", "b"];
			const results = await embedChunks(chunks);

			expect(results).toHaveLength(2);
			expect(embedSpy).toHaveBeenCalledTimes(3); // 1 batch (fail) + 2 individual

			embedSpy.mockRestore();
		});

		test("handles errors in individual embedding", async () => {
			const embedSpy = spyOn(AiEngine.prototype, "embed").mockRejectedValue(
				new Error("Fail"),
			);

			const chunks = ["a"];
			const results = await embedChunks(chunks);

			expect(results).toHaveLength(1);
			expect(results[0]?.embedding).toBeNull();

			embedSpy.mockRestore();
		});

		test("returns empty for empty chunks", async () => {
			const results = await embedChunks([]);
			expect(results).toEqual([]);
		});
	});

	describe("chunkText", () => {
		test("chunks by size when no boundaries", () => {
			const text = "a\n".repeat(1500);
			const chunks = chunkText(text, { maxChars: 1000, overlapLines: 0 });
			expect(chunks.length).toBe(3);
		});

		test("chunks by boundary", () => {
			const text = `
export function a() {
  ${"x".repeat(100)}
}
export function b() {
  ${"y".repeat(100)}
}
`;
			const chunks = chunkText(text, { maxChars: 200 });
			expect(chunks.length).toBeGreaterThanOrEqual(2);
			expect(chunks[0]).toContain("function a");
			expect(chunks[1]).toContain("function b");
		});

		test("handles empty input", () => {
			expect(chunkText("")).toEqual([]);
		});

		test("sub-chunks large segments within boundaries", () => {
			const hugeFunc = `export function huge() {\n${"lines\n".repeat(100)}}`;
			const chunks = chunkText(hugeFunc, { maxChars: 200 });
			expect(chunks.length).toBeGreaterThan(1);
			expect(chunks[0]).toContain("export function huge");
		});
	});
});
