import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { setupCronJobsTable } from "./schema/cron_jobs";
import { setupCronLogsTable } from "./schema/cron_logs";

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

export type CronJobUpdate = Partial<CronJobSpec> & {
	last_run_at?: string;
	last_status?: string;
	next_run_at?: string;
};

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
	private deleteJob;
	private updateJob;
	private toggleJob;
	private insertLog;
	private selectLogs;

	constructor(private db: Database) {
		setupCronJobsTable(db);
		setupCronLogsTable(db);
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
		this.deleteJob = db.prepare("DELETE FROM cron_jobs WHERE name = $name");
		this.updateJob = db.prepare(`
			UPDATE cron_jobs SET
				command = COALESCE($command, command),
				schedule = COALESCE($schedule, schedule),
				description = COALESCE($description, description),
				enabled = COALESCE($enabled, enabled),
				on_failure = COALESCE($on_failure, on_failure),
				retries = COALESCE($retries, retries),
				timeout = COALESCE($timeout, timeout),
				start_at = COALESCE($start_at, start_at),
				end_at = COALESCE($end_at, end_at),
				max_runs = COALESCE($max_runs, max_runs),
				last_run_at = COALESCE($last_run_at, last_run_at),
				last_status = COALESCE($last_status, last_status),
				next_run_at = COALESCE($next_run_at, next_run_at),
				updated_at = CURRENT_TIMESTAMP
			WHERE name = $name
		`);
		this.toggleJob = db.prepare(`
			UPDATE cron_jobs SET enabled = $enabled, updated_at = CURRENT_TIMESTAMP
			WHERE name = $name
		`);
		this.insertLog = db.prepare(`
			INSERT INTO cron_logs (
				id, job_id, job_name, status, started_at, finished_at,
				duration_ms, output, error
			) VALUES (
				$id, $job_id, $job_name, $status, $started_at, $finished_at,
				$duration_ms, $output, $error
			)
		`);
		this.selectLogs = db.prepare(`
			SELECT id, job_id, job_name, status, started_at, finished_at,
				duration_ms, output, error, created_at
			FROM cron_logs
			WHERE job_name = $job_name
			ORDER BY started_at DESC
			LIMIT $limit
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

	deleteJobByName(name: string): boolean {
		const result = this.deleteJob.run({ $name: name });
		return result.changes > 0;
	}

	updateJobByName(name: string, spec: CronJobUpdate) {
		this.updateJob.run({
			$command: spec.command ?? null,
			$schedule: spec.schedule ?? null,
			$description: spec.description ?? null,
			$enabled: spec.enabled === undefined ? null : spec.enabled ? 1 : 0,
			$on_failure: spec.on_failure ?? null,
			$retries: spec.retries ?? null,
			$timeout: spec.timeout ?? null,
			$start_at: spec.start_at ?? null,
			$end_at: spec.end_at ?? null,
			$max_runs: spec.max_runs ?? null,
			$last_run_at: spec.last_run_at ?? null,
			$last_status: spec.last_status ?? null,
			$next_run_at: spec.next_run_at ?? null,
			$name: name,
		});
	}

	toggleJobByName(name: string, enabled: boolean) {
		this.toggleJob.run({ $name: name, $enabled: enabled ? 1 : 0 });
	}

	recordExecution(
		name: string,
		status: "success" | "failure",
		options: {
			startedAt?: string;
			finishedAt?: string;
			durationMs?: number;
			output?: string;
			error?: string;
		} = {},
	) {
		const job = this.getByName(name);
		if (!job) return null;
		const startedAt = options.startedAt ?? new Date().toISOString();
		const finishedAt = options.finishedAt ?? new Date().toISOString();
		const id = randomUUID();
		this.insertLog.run({
			$id: id,
			$job_id: job.id,
			$job_name: job.name,
			$status: status,
			$started_at: startedAt,
			$finished_at: finishedAt,
			$duration_ms: options.durationMs ?? null,
			$output: options.output ?? null,
			$error: options.error ?? null,
		});
		this.updateJobByName(name, {
			last_run_at: finishedAt,
			last_status: status,
			next_run_at: job.schedule,
		});
		return {
			id,
			job_id: job.id,
			job_name: job.name,
			status,
			started_at: startedAt,
			finished_at: finishedAt,
			duration_ms: options.durationMs ?? null,
			output: options.output ?? null,
			error: options.error ?? null,
		};
	}

	listLogs(name: string, limit = 10, since?: string) {
		const rows = this.selectLogs.all({
			$job_name: name,
			$limit: limit,
		});
		return rows
			.filter((row) => (since ? row.started_at >= since : true))
			.map((row) => ({
				id: row.id,
				job_id: row.job_id,
				job_name: row.job_name,
				status: row.status,
				started_at: row.started_at,
				finished_at: row.finished_at,
				duration_ms: row.duration_ms,
				output: row.output,
				error: row.error,
				created_at: row.created_at,
			}));
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
