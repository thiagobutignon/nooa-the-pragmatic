import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CronJobRecord } from "../../core/db/cron_store";
import type { CronService } from "./service";

const HEARTBEAT_JOB_NAME = "__system_heartbeat__";
const HEARTBEAT_COMMAND = "heartbeat:run";

export interface CommandExecutionResult {
	status: "success" | "failure";
	output?: string;
	error?: string;
}

type CommandExecutor = (job: CronJobRecord) => Promise<CommandExecutionResult>;

export interface CronDaemonOptions {
	workspace?: string;
	pidPath?: string;
	heartbeatEnabled?: boolean;
	heartbeatSchedule?: string;
	pollIntervalMs?: number;
	executeCommand?: CommandExecutor;
}

export class CronDaemon {
	private readonly workspace: string;
	private readonly pidPath: string;
	private readonly heartbeatEnabled: boolean;
	private readonly heartbeatSchedule: string;
	private readonly pollIntervalMs: number;
	private readonly executeCommand: CommandExecutor;

	constructor(
		private readonly service: CronService,
		options: CronDaemonOptions = {},
	) {
		this.workspace = options.workspace ?? process.cwd();
		this.pidPath =
			options.pidPath ??
			process.env.NOOA_CRON_DAEMON_PID_PATH ??
			join(this.workspace, ".nooa", "cron-daemon.pid");
		this.heartbeatEnabled =
			options.heartbeatEnabled ?? process.env.NOOA_HEARTBEAT_ENABLED !== "0";
		this.heartbeatSchedule =
			options.heartbeatSchedule ??
			process.env.NOOA_HEARTBEAT_SCHEDULE ??
			"30m";
		this.pollIntervalMs = options.pollIntervalMs ?? this.readPollInterval();
		this.executeCommand = options.executeCommand ?? this.executeViaShell;
	}

	private readPollInterval(): number {
		const raw = process.env.NOOA_CRON_DAEMON_POLL_MS;
		if (!raw) {
			return 30_000;
		}
		const value = Number(raw);
		if (!Number.isFinite(value) || value < 100) {
			return 30_000;
		}
		return value;
	}

	async ensureSystemJobs() {
		if (!this.heartbeatEnabled) {
			return;
		}
		const existing = this.service.getJob(HEARTBEAT_JOB_NAME);
		if (existing) {
			return;
		}
		await this.service.addJob({
			name: HEARTBEAT_JOB_NAME,
			schedule: this.heartbeatSchedule,
			command: HEARTBEAT_COMMAND,
			description: "Native heartbeat runner",
			enabled: true,
		});
	}

	private async executeViaShell(
		job: CronJobRecord,
	): Promise<CommandExecutionResult> {
		if (job.command === HEARTBEAT_COMMAND) {
			const output = await this.runHeartbeat();
			return { status: "success", output };
		}
		const proc = Bun.spawn(["sh", "-lc", job.command], {
			stdout: "pipe",
			stderr: "pipe",
			cwd: this.workspace,
		});
		const [stdoutText, stderrText, code] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		if (code === 0) {
			return { status: "success", output: stdoutText.trim() };
		}
		return {
			status: "failure",
			output: stdoutText.trim(),
			error: stderrText.trim() || `Command exited with code ${code}`,
		};
	}

	private async runHeartbeat(): Promise<string> {
		try {
			const file = join(this.workspace, ".nooa", "HEARTBEAT.md");
			const content = await readFile(file, "utf8");
			const trimmed = content.trim();
			if (trimmed.length === 0) {
				return "HEARTBEAT_OK";
			}
			return trimmed;
		} catch {
			return "HEARTBEAT_OK";
		}
	}

	private parseNextRun(schedule: string, from: Date): Date {
		const trimmed = schedule.trim();
		const intervalMatch = /^(\d+)([smhd])$/i.exec(trimmed);
		if (intervalMatch) {
			const amount = Number(intervalMatch[1]);
			const unit = intervalMatch[2].toLowerCase();
			const unitMs =
				unit === "s"
					? 1_000
					: unit === "m"
						? 60_000
						: unit === "h"
							? 3_600_000
							: 86_400_000;
			return new Date(from.getTime() + amount * unitMs);
		}
		if (trimmed === "@hourly") {
			return new Date(from.getTime() + 3_600_000);
		}
		if (trimmed === "@daily") {
			return new Date(from.getTime() + 86_400_000);
		}
		return new Date(from.getTime() + 60_000);
	}

	private isDue(now: Date, nextRunAt?: string): boolean {
		if (!nextRunAt) return false;
		const parsed = new Date(nextRunAt);
		if (Number.isNaN(parsed.getTime())) return false;
		return parsed.getTime() <= now.getTime();
	}

	async tick(now = new Date()) {
		await this.ensureSystemJobs();
		const jobs = this.service.listJobs().filter((job) => job.enabled);
		for (const job of jobs) {
			if (!job.next_run_at) {
				this.service.updateRuntime(job.name, {
					next_run_at: this.parseNextRun(job.schedule, now).toISOString(),
				});
				continue;
			}
			if (!this.isDue(now, job.next_run_at)) {
				continue;
			}

			const startedAt = new Date();
			const result =
				job.command === HEARTBEAT_COMMAND
					? {
							status: "success" as const,
							output: await this.runHeartbeat(),
						}
					: await this.executeCommand(job);
			const finishedAt = new Date();
			const durationMs = finishedAt.getTime() - startedAt.getTime();
			this.service.recordExecution(job.name, result.status, {
				startedAt: startedAt.toISOString(),
				finishedAt: finishedAt.toISOString(),
				durationMs,
				output: result.output,
				error: result.error,
			});
			this.service.updateRuntime(job.name, {
				next_run_at: this.parseNextRun(job.schedule, finishedAt).toISOString(),
			});
		}
	}

	private async ensurePidDirectory() {
		await mkdir(dirname(this.pidPath), { recursive: true });
	}

	private async readPid(): Promise<number | null> {
		try {
			const raw = await readFile(this.pidPath, "utf8");
			const pid = Number(raw.trim());
			if (!Number.isInteger(pid) || pid <= 0) {
				return null;
			}
			return pid;
		} catch {
			return null;
		}
	}

	private isRunning(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	async status() {
		const pid = await this.readPid();
		if (!pid) {
			return { running: false, pid: null as number | null };
		}
		if (!this.isRunning(pid)) {
			await rm(this.pidPath, { force: true });
			return { running: false, pid: null as number | null };
		}
		return { running: true, pid };
	}

	async startDetached(entrypoint: string) {
		const current = await this.status();
		if (current.running && current.pid) {
			return current;
		}
		await this.ensurePidDirectory();
		const child = Bun.spawn(["bun", entrypoint, "cron", "daemon-run"], {
			cwd: this.workspace,
			env: process.env,
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
			detached: true,
		});
		child.unref();
		await writeFile(this.pidPath, String(child.pid), "utf8");
		return { running: true, pid: child.pid };
	}

	async stop() {
		const current = await this.status();
		if (!current.running || !current.pid) {
			return { running: false, pid: null as number | null };
		}
		try {
			process.kill(current.pid, "SIGTERM");
		} catch {
			// process may have exited between status and signal
		}
		await rm(this.pidPath, { force: true });
		return { running: false, pid: null as number | null };
	}

	async runLoop() {
		await this.ensureSystemJobs();
		let running = true;
		const stop = () => {
			running = false;
		};
		process.on("SIGTERM", stop);
		process.on("SIGINT", stop);
		while (running) {
			await this.tick(new Date());
			await Bun.sleep(this.pollIntervalMs);
		}
		process.off("SIGTERM", stop);
		process.off("SIGINT", stop);
	}
}
