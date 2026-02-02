import type { Database } from "bun:sqlite";

/**
 * Setup the cron_jobs table used to persist recurring job definitions.
 */
export function setupCronJobsTable(db: Database) {
	db.run(`
        CREATE TABLE IF NOT EXISTS cron_jobs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            schedule TEXT NOT NULL,
            command TEXT NOT NULL,
            description TEXT,
            enabled INTEGER DEFAULT 1,
            on_failure TEXT DEFAULT 'notify',
            retries INTEGER DEFAULT 0,
            timeout TEXT,
            start_at TEXT,
            end_at TEXT,
            max_runs INTEGER DEFAULT 0,
            last_run_at TEXT,
            last_status TEXT,
            next_run_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
}
