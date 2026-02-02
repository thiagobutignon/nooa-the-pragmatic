import type { Database } from "bun:sqlite";

export function setupCronTable(db: Database) {
	db.run(`
		CREATE TABLE IF NOT EXISTS cron_jobs (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			schedule TEXT NOT NULL,
			command TEXT NOT NULL,
			next_run_at TEXT,
			enabled INTEGER DEFAULT 1
		)
	`);
}
