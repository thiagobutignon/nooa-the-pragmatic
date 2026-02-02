import type { Database } from "bun:sqlite";

/**
 * Setup the embeddings table for semantic search.
 * We store chunks of text and their corresponding vector embeddings.
 */
export function setupEmbeddingsTable(db: Database) {
	db.run(`
        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            chunk TEXT NOT NULL,
            vector BLOB NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

	db.run("CREATE INDEX IF NOT EXISTS idx_embeddings_path ON embeddings(path)");
}
