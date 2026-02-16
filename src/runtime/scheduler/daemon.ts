import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

export interface SchedulerJobScheduleEvery {
	kind: "every";
	everySeconds: number;
}

export interface SchedulerJobScheduleAt {
	kind: "at";
	runAt: string;
}

export type SchedulerJobSchedule =
	| SchedulerJobScheduleEvery
	| SchedulerJobScheduleAt;

export interface SchedulerJob {
	id: string;
	name: string;
	message: string;
	channel: string;
	chatId: string;
	schedule: SchedulerJobSchedule;
	nextRunAt: string;
	lastRunAt?: string;
	isHeartbeat?: boolean;
}

export interface SchedulerAddJobInput {
	name: string;
	message: string;
	channel: string;
	chatId: string;
	atSeconds?: number;
	everySeconds?: number;
}

export interface SchedulerDaemonOptions {
	heartbeatEverySeconds?: number;
	enableHeartbeatJob?: boolean;
}

export class SchedulerDaemon {
	private readonly jobs = new Map<string, SchedulerJob>();
	private readonly storagePath: string;
	private readonly heartbeatEverySeconds: number;
	private readonly enableHeartbeatJob: boolean;

	constructor(
		workspace: string = process.cwd(),
		options: SchedulerDaemonOptions = {},
	) {
		this.storagePath = join(workspace, ".nooa", "cron-jobs.json");
		this.heartbeatEverySeconds = options.heartbeatEverySeconds ?? 1800;
		this.enableHeartbeatJob = options.enableHeartbeatJob ?? true;
		this.load();
		if (this.enableHeartbeatJob) {
			this.ensureHeartbeatJob();
		}
	}

	addJob(input: SchedulerAddJobInput): string {
		const now = Date.now();
		const id = this.createId(input.name);
		const schedule = this.buildSchedule(input, now);
		const nextRunAt = this.computeNextRunAt(schedule, now);

		const job: SchedulerJob = {
			id,
			name: input.name,
			message: input.message,
			channel: input.channel,
			chatId: input.chatId,
			schedule,
			nextRunAt,
		};
		this.jobs.set(id, job);
		this.save();
		return id;
	}

	listJobs(): SchedulerJob[] {
		return [...this.jobs.values()];
	}

	removeJob(id: string): boolean {
		const removed = this.jobs.delete(id);
		if (removed) {
			this.save();
		}
		return removed;
	}

	getDueJobs(nowMs: number = Date.now()): SchedulerJob[] {
		const due: SchedulerJob[] = [];
		let changed = false;

		for (const [id, job] of this.jobs.entries()) {
			const nextRunMs = Date.parse(job.nextRunAt);
			if (Number.isNaN(nextRunMs) || nextRunMs > nowMs) {
				continue;
			}

			due.push({ ...job });
			if (job.schedule.kind === "every") {
				job.lastRunAt = new Date(nowMs).toISOString();
				job.nextRunAt = new Date(
					nowMs + job.schedule.everySeconds * 1000,
				).toISOString();
				this.jobs.set(id, job);
				changed = true;
			} else {
				this.jobs.delete(id);
				changed = true;
			}
		}

		if (changed) {
			this.save();
		}

		return due;
	}

	private ensureHeartbeatJob(): void {
		const existing = this.listJobs().find((job) => job.isHeartbeat === true);
		if (existing) {
			return;
		}

		const id = "heartbeat-native";
		const now = Date.now();
		const job: SchedulerJob = {
			id,
			name: "heartbeat",
			message: "Run periodic heartbeat instructions",
			channel: "cli",
			chatId: "direct",
			schedule: { kind: "every", everySeconds: this.heartbeatEverySeconds },
			nextRunAt: new Date(
				now + this.heartbeatEverySeconds * 1000,
			).toISOString(),
			isHeartbeat: true,
		};
		this.jobs.set(id, job);
		this.save();
	}

	private buildSchedule(
		input: SchedulerAddJobInput,
		nowMs: number,
	): SchedulerJobSchedule {
		if (typeof input.everySeconds === "number") {
			if (input.everySeconds <= 0) {
				throw new Error("everySeconds must be greater than 0");
			}
			return {
				kind: "every",
				everySeconds: input.everySeconds,
			};
		}
		const atSeconds = input.atSeconds ?? 0;
		return {
			kind: "at",
			runAt: new Date(nowMs + atSeconds * 1000).toISOString(),
		};
	}

	private computeNextRunAt(
		schedule: SchedulerJobSchedule,
		nowMs: number,
	): string {
		if (schedule.kind === "every") {
			return new Date(nowMs + schedule.everySeconds * 1000).toISOString();
		}
		return schedule.runAt;
	}

	private createId(name: string): string {
		const slug = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-");
		return `${slug}-${Date.now()}`;
	}

	private load(): void {
		if (!existsSync(this.storagePath)) {
			return;
		}
		try {
			const content = readFileSync(this.storagePath, "utf8");
			const parsed = JSON.parse(content) as SchedulerJob[];
			for (const job of parsed) {
				if (!job?.id || !job?.name || !job?.schedule) {
					continue;
				}
				this.jobs.set(job.id, job);
			}
		} catch {
			// ignore malformed scheduler storage
		}
	}

	private save(): void {
		const dir = join(this.storagePath, "..");
		mkdirSync(dir, { recursive: true });
		const data = JSON.stringify(this.listJobs(), null, 2);
		const tmpPath = `${this.storagePath}.tmp`;
		writeFileSync(tmpPath, data, "utf8");
		renameSync(tmpPath, this.storagePath);
	}
}
