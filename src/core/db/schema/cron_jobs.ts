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

	// Add missing columns if they don't exist (primitive migration)
	const columns = db.query("PRAGMA table_info(cron_jobs)").all() as {
		name: string;
	}[];
	const columnNames = columns.map((c) => c.name);

	const missingColumns = [
		{ name: "description", type: "TEXT" },
		{ name: "on_failure", type: "TEXT DEFAULT 'notify'" },
		{ name: "retries", type: "INTEGER DEFAULT 0" },
		{ name: "timeout", type: "TEXT" },
		{ name: "start_at", type: "TEXT" },
		{ name: "end_at", type: "TEXT" },
		{ name: "max_runs", type: "INTEGER DEFAULT 0" },
		{ name: "last_run_at", type: "TEXT" },
		{ name: "last_status", type: "TEXT" },
		{ name: "created_at", type: "TEXT DEFAULT CURRENT_TIMESTAMP" },
		{ name: "updated_at", type: "TEXT DEFAULT CURRENT_TIMESTAMP" },
	];

	for (const col of missingColumns) {
		if (!columnNames.includes(col.name)) {
			try {
				db.run(`ALTER TABLE cron_jobs ADD COLUMN ${col.name} ${col.type}`);
			} catch (err) {
				// Specific handling for overlapping columns during migration
				console.warn(
					`Could not add column ${col.name}:`,
					(err as Error).message,
				);
			}
		}
	}
}
