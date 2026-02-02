import type { Database } from "bun:sqlite";

export function setupCronLogsTable(db: Database) {
	db.run(`
        CREATE TABLE IF NOT EXISTS cron_logs (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            job_name TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT NOT NULL,
            duration_ms INTEGER,
            output TEXT,
            error TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
        )
    `);
}
