import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SchedulerDaemon } from "./daemon";

describe("SchedulerDaemon", () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), "nooa-scheduler-"));
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it("registers a one-time job", () => {
		const daemon = new SchedulerDaemon(workspace, {
			enableHeartbeatJob: false,
		});
		const id = daemon.addJob({
			name: "remind",
			message: "Check emails",
			atSeconds: 60,
			channel: "cli",
			chatId: "direct",
		});
		expect(id).toBeDefined();
		expect(daemon.listJobs()).toHaveLength(1);
	});

	it("registers a recurring job", () => {
		const daemon = new SchedulerDaemon(workspace, {
			enableHeartbeatJob: false,
		});
		daemon.addJob({
			name: "health",
			message: "Check disk",
			everySeconds: 3600,
			channel: "cli",
			chatId: "direct",
		});
		const jobs = daemon.listJobs();
		expect(jobs[0]?.schedule.kind).toBe("every");
	});

	it("removes a job", () => {
		const daemon = new SchedulerDaemon(workspace, {
			enableHeartbeatJob: false,
		});
		const id = daemon.addJob({
			name: "test",
			message: "test",
			atSeconds: 10,
			channel: "cli",
			chatId: "direct",
		});
		expect(daemon.removeJob(id)).toBe(true);
		expect(daemon.listJobs()).toHaveLength(0);
	});

	it("checks for due jobs", () => {
		const daemon = new SchedulerDaemon(workspace, {
			enableHeartbeatJob: false,
		});
		daemon.addJob({
			name: "immediate",
			message: "now!",
			atSeconds: -1,
			channel: "cli",
			chatId: "direct",
		});

		const due = daemon.getDueJobs();
		expect(due.length).toBeGreaterThanOrEqual(1);
	});
});
