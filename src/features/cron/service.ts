import { Database } from "bun:sqlite";
import type { CronJobRecord, CronJobSpec } from "../../core/db/cron_store";
import { CronStore } from "../../core/db/cron_store";

const DEFAULT_DB_PATH = process.env.NOOA_DB_PATH || "nooa.db";

export type CronLogEntry = {
	id: string;
	job_id: string;
	job_name: string;
	status: string;
	started_at: string;
	finished_at: string;
	duration_ms?: number;
	output?: string | null;
	error?: string | null;
	created_at: string;
};

class CronService {
	private store: CronStore;

	constructor(path: string = DEFAULT_DB_PATH) {
		this.store = new CronStore(new Database(path));
	}

	addJob(spec: CronJobSpec) {
		this.store.createJob(spec);
	}

	listJobs(): CronJobRecord[] {
		return this.store.listJobs();
	}

	getJob(name: string) {
		return this.store.getByName(name);
	}

	removeJob(name: string) {
		return this.store.deleteJobByName(name);
	}

	enableJob(name: string) {
		this.store.toggleJobByName(name, true);
	}

	disableJob(name: string) {
		this.store.toggleJobByName(name, false);
	}

	editJob(name: string, updates: Partial<CronJobSpec>) {
		this.store.updateJobByName(name, updates);
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
		return this.store.recordExecution(name, status, options);
	}

	listLogs(name: string, limit = 10, since?: string) {
		return this.store.listLogs(name, limit, since);
	}
}

export const cronService = new CronService();
