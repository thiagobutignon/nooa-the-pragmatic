import { expect, test, describe } from "bun:test";
import { Database } from "bun:sqlite";
import { setupEmbeddingsTable } from "./schema/embeddings";

describe("Embeddings Schema", () => {
	test("creates embeddings table", () => {
		const db = new Database(":memory:");
		setupEmbeddingsTable(db);

		// Check if table exists
		const result = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='embeddings'",
			)
			.get() as { name: string } | null;

		expect(result).toBeDefined();
		expect(result?.name).toBe("embeddings");

		// Check columns
		const info = db.query("PRAGMA table_info(embeddings)").all() as any[];
		const names = info.map((i) => i.name);
		expect(names).toContain("id");
		expect(names).toContain("path");
		expect(names).toContain("chunk");
		expect(names).toContain("vector");
	});
});
