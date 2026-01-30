import { Database } from "bun:sqlite";

export interface Job {
	id?: number;
	provider: string;
	externalId: string;
	title: string;
	company: string;
	url: string;
	location?: string;
	description?: string;
	matchScore: number;
	status: "saved" | "applied" | "ignored";
	createdAt?: string;
	rawPayload?: string;
}

const DB_PATH = "nooa.db";

export class JobDatabase {
	private db: Database;

	constructor(path: string = DB_PATH) {
		this.db = new Database(path);
		this.init();
	}

	private init() {
		this.db.run(`
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                external_id TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                url TEXT NOT NULL,
                location TEXT,
                description TEXT,
                match_score REAL DEFAULT 0,
                status TEXT DEFAULT 'saved',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                raw_payload TEXT
            )
        `);

		this.db.run(`
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                date_applied DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        `);
	}

	saveJob(job: Job): number | bigint {
		const query = this.db.prepare(`
            INSERT INTO jobs (
                provider, external_id, title, company, url, location, description, match_score, status, raw_payload
            ) VALUES (
                $provider, $externalId, $title, $company, $url, $location, $description, $matchScore, $status, $rawPayload
            ) ON CONFLICT(external_id) DO UPDATE SET
                match_score = excluded.match_score,
                description = excluded.description,
                status = CASE WHEN jobs.status = 'ignored' THEN 'ignored' ELSE jobs.status END
        `);

		const result = query.run({
			$provider: job.provider,
			$externalId: job.externalId,
			$title: job.title,
			$company: job.company,
			$url: job.url,
			$location: job.location || null,
			$description: job.description || null,
			$matchScore: job.matchScore,
			$status: job.status,
			$rawPayload: job.rawPayload || null,
		});

		return result.lastInsertRowid;
	}

	listJobs(
		filters: { status?: string; provider?: string } = {},
	): Array<Record<string, unknown>> {
		let sql = "SELECT * FROM jobs";
		const params: Record<string, string> = {};

		const clauses: string[] = [];
		if (filters.status) {
			clauses.push("status = $status");
			params.$status = filters.status;
		}
		if (filters.provider) {
			clauses.push("provider = $provider");
			params.$provider = filters.provider;
		}

		if (clauses.length > 0) {
			sql += ` WHERE ${clauses.join(" AND ")}`;
		}

		sql += " ORDER BY match_score DESC, created_at DESC";

		return this.db.query(sql).all(params) as Array<Record<string, unknown>>;
	}

	updateJobStatus(id: number, status: "saved" | "applied" | "ignored") {
		this.db.run("UPDATE jobs SET status = ? WHERE id = ?", [status, id]);

		if (status === "applied") {
			this.db.run("INSERT INTO applications (job_id) VALUES (?)", [id]);
		}
	}

	close() {
		this.db.close();
	}
}

export const db = new JobDatabase();
