import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { setupCronJobsTable } from "./schema/cron_jobs";

export interface CronJobSpec {
	name: string;
	command: string;
	schedule: string;
	description?: string;
	enabled?: boolean;
	on_failure?: "notify" | "retry" | "ignore";
	retries?: number;
	timeout?: string;
	start_at?: string;
	end_at?: string;
	max_runs?: number;
}

export interface CronJobRecord extends CronJobSpec {
	id: string;
	last_run_at?: string;
	last_status?: string;
	next_run_at?: string;
	created_at: string;
	updated_at: string;
}

export class CronStore {
	private insertJob;
	private selectJobs;

	constructor(private db: Database) {
		setupCronJobsTable(db);
		this.insertJob = db.prepare(`
            INSERT INTO cron_jobs (
                id, name, schedule, command, description, enabled,
                on_failure, retries, timeout, start_at, end_at, max_runs
            ) VALUES (
                $id, $name, $schedule, $command, $description, $enabled,
                $on_failure, $retries, $timeout, $start_at, $end_at, $max_runs
            )
        `);
		this.selectJobs = db.prepare(`
            SELECT
                id, name, schedule, command, description, enabled,
                on_failure, retries, timeout, start_at, end_at, max_runs,
                last_run_at, last_status, next_run_at, created_at, updated_at
            FROM cron_jobs
            ORDER BY created_at DESC
        `);
	}

	async createJob(spec: CronJobSpec) {
		const id = randomUUID();
		this.insertJob.run({
			$id: id,
			$name: spec.name,
			$schedule: spec.schedule,
			$command: spec.command,
			$description: spec.description ?? null,
			$enabled: spec.enabled === false ? 0 : 1,
			$on_failure: spec.on_failure ?? "notify",
			$retries: spec.retries ?? 0,
			$timeout: spec.timeout ?? null,
			$start_at: spec.start_at ?? null,
			$end_at: spec.end_at ?? null,
			$max_runs: spec.max_runs ?? 0,
		});
	}

	listJobs(): CronJobRecord[] {
		return this.selectJobs.all().map((row) => ({
			id: row.id,
			name: row.name,
			schedule: row.schedule,
			command: row.command,
			description: row.description,
			enabled: Boolean(row.enabled),
			on_failure: row.on_failure,
			retries: row.retries,
			timeout: row.timeout,
			start_at: row.start_at,
			end_at: row.end_at,
			max_runs: row.max_runs,
			last_run_at: row.last_run_at,
			last_status: row.last_status,
			next_run_at: row.next_run_at,
			created_at: row.created_at,
			updated_at: row.updated_at,
		}));
	}

	getByName(name: string): CronJobRecord | null {
		const row = this.db
			.prepare("SELECT * FROM cron_jobs WHERE name = $name")
			.get({ $name: name });
		if (!row) return null;
		return {
			id: row.id,
			name: row.name,
			schedule: row.schedule,
			command: row.command,
			description: row.description,
			enabled: Boolean(row.enabled),
			on_failure: row.on_failure,
			retries: row.retries,
			timeout: row.timeout,
			start_at: row.start_at,
			end_at: row.end_at,
			max_runs: row.max_runs,
			last_run_at: row.last_run_at,
			last_status: row.last_status,
			next_run_at: row.next_run_at,
			created_at: row.created_at,
			updated_at: row.updated_at,
		};
	}
}
