import { Database } from "bun:sqlite";
import { setupEmbeddingsTable } from "./schema/embeddings";

const DEFAULT_DB_PATH = process.env.NOOA_DB_PATH || "nooa.db";

export class Store {
	private db: Database;

	constructor(path: string = DEFAULT_DB_PATH) {
		this.db = new Database(path);
		this.init();
	}

	private init() {
		setupEmbeddingsTable(this.db);
	}

	async storeEmbedding(path: string, chunk: string, vector: number[]) {
		const query = this.db.prepare(`
            INSERT INTO embeddings (id, path, chunk, vector)
            VALUES ($id, $path, $chunk, $vector)
            ON CONFLICT(id) DO UPDATE SET
                chunk = excluded.chunk,
                vector = excluded.vector,
                created_at = CURRENT_TIMESTAMP
        `);

		// Generate a deterministic ID based on path and chunk hash
		const id = Bun.hash(`${path}:${chunk}`).toString(16);

		query.run({
			$id: id,
			$path: path,
			$chunk: chunk,
			$vector: Buffer.from(new Float32Array(vector).buffer),
		});
	}

	async searchEmbeddings(vector: number[], limit = 5) {
		const all = this.db.query("SELECT id, path, chunk, vector FROM embeddings").all() as any[];
		
		const queryVector = new Float32Array(vector);
		
		const results = all.map((row) => {
			if (!row.vector) return { ...row, score: 0 };
			const rowVector = new Float32Array(
				row.vector.buffer,
				row.vector.byteOffset,
				row.vector.byteLength / 4,
			);
			const score = this.cosineSimilarity(queryVector, rowVector);
			return { ...row, score };
		});

		return results.sort((a, b) => b.score - a.score).slice(0, limit);
	}

	private cosineSimilarity(a: Float32Array, b: Float32Array): number {
		if (a.length !== b.length) return 0;
		let dotProduct = 0;
		let mA = 0;
		let mB = 0;
		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			mA += a[i] * a[i];
			mB += b[i] * b[i];
		}
		const denom = Math.sqrt(mA) * Math.sqrt(mB);
		return denom === 0 ? 0 : dotProduct / denom;
	}

	close() {
		this.db.close();
	}
}

export const store = new Store();
