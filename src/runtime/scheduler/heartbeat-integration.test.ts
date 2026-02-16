import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SchedulerDaemon } from "./daemon";

describe("SchedulerDaemon heartbeat integration", () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), "nooa-scheduler-hb-"));
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it("creates native heartbeat recurring job by default", () => {
		const daemon = new SchedulerDaemon(workspace);
		const heartbeat = daemon.listJobs().find((job) => job.isHeartbeat === true);
		expect(heartbeat).toBeDefined();
		expect(heartbeat?.schedule.kind).toBe("every");
		expect(
			heartbeat?.schedule.kind === "every"
				? heartbeat.schedule.everySeconds
				: undefined,
		).toBe(1800);
	});

	it("allows custom heartbeat interval", () => {
		const daemon = new SchedulerDaemon(workspace, {
			heartbeatEverySeconds: 120,
		});
		const heartbeat = daemon.listJobs().find((job) => job.isHeartbeat === true);
		expect(
			heartbeat?.schedule.kind === "every"
				? heartbeat.schedule.everySeconds
				: undefined,
		).toBe(120);
	});
});
