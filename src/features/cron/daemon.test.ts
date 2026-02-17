import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CronService } from "./service";
import { CronDaemon } from "./daemon";

describe("CronDaemon", () => {
	let dir: string;
	let dbPath: string;
	let service: CronService;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "nooa-cron-daemon-"));
		dbPath = join(dir, "cron.db");
		service = new CronService(dbPath);
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	test("executes due jobs and updates next_run_at", async () => {
		await service.addJob({
			name: "due-job",
			schedule: "1m",
			command: "echo done",
		});
		service.updateRuntime("due-job", {
			next_run_at: new Date(Date.now() - 60_000).toISOString(),
		});

		const daemon = new CronDaemon(service, {
			workspace: dir,
			executeCommand: () => ({
				status: "success",
				output: "ok",
			}),
		});

		await daemon.tick(new Date());

		const logs = service.listLogs("due-job");
		expect(logs).toHaveLength(1);
		expect(logs[0]?.status).toBe("success");

		const job = service.getJob("due-job");
		expect(job?.next_run_at).toBeTruthy();
		expect(job?.last_status).toBe("success");
	});

	test("creates and executes heartbeat native job", async () => {
		await mkdir(join(dir, ".nooa"), { recursive: true });
		await writeFile(
			join(dir, ".nooa", "HEARTBEAT.md"),
			"- check inbox\n- summarize updates",
		);

		const daemon = new CronDaemon(service, {
			workspace: dir,
			heartbeatSchedule: "1m",
			executeCommand: () => ({
				status: "success",
				output: "ignored",
			}),
		});

		await daemon.ensureSystemJobs();
		const heartbeat = service.getJob("__system_heartbeat__");
		expect(heartbeat).toBeTruthy();
		expect(heartbeat?.enabled).toBe(true);

		service.updateRuntime("__system_heartbeat__", {
			next_run_at: new Date(Date.now() - 60_000).toISOString(),
		});
		await daemon.tick(new Date());
		const logs = service.listLogs("__system_heartbeat__", 10);
		expect(logs).toHaveLength(1);
		expect(logs[0]?.output).toContain("check inbox");
	});

	test("initializes next_run_at and executes shell commands", async () => {
		await service.addJob({
			name: "shell-ok",
			schedule: "1s",
			command: "echo shell-ok",
		});
		await service.addJob({
			name: "shell-fail",
			schedule: "1s",
			command: "sh -lc 'echo boom 1>&2; exit 9'",
		});

		const daemon = new CronDaemon(service, {
			workspace: dir,
			heartbeatEnabled: false,
		});
		const now = new Date();
		await daemon.tick(now);

		const scheduled = service.getJob("shell-ok");
		expect(scheduled?.next_run_at).toBeTruthy();

		service.updateRuntime("shell-ok", {
			next_run_at: new Date(now.getTime() - 2_000).toISOString(),
		});
		service.updateRuntime("shell-fail", {
			next_run_at: new Date(now.getTime() - 2_000).toISOString(),
		});
		await daemon.tick(new Date(now.getTime() + 2_000));

		const successLogs = service.listLogs("shell-ok");
		expect(successLogs[0]?.status).toBe("success");
		expect(successLogs[0]?.output).toContain("shell-ok");

		const failureLogs = service.listLogs("shell-fail");
		expect(failureLogs[0]?.status).toBe("failure");
		expect(failureLogs[0]?.error).toContain("boom");
	});

	test("daemon lifecycle start/status/stop", async () => {
		const pidPath = join(dir, "daemon.pid");
		const daemon = new CronDaemon(service, {
			workspace: dir,
			pidPath,
			heartbeatEnabled: false,
		});

		const before = await daemon.status();
		expect(before.running).toBe(false);

		const entrypoint = fileURLToPath(new URL("../../../index.ts", import.meta.url));
		const started = await daemon.startDetached(entrypoint);
		expect(started.running).toBe(true);
		expect(started.pid).toBeGreaterThan(0);

		const running = await daemon.status();
		expect(running.running).toBe(true);

		const stopped = await daemon.stop();
		expect(stopped.running).toBe(false);

		const after = await daemon.status();
		expect(after.running).toBe(false);
	});

	test("service wrappers toggle and remove jobs", async () => {
		await service.addJob({
			name: "toggle-me",
			schedule: "5m",
			command: "echo x",
		});
		service.disableJob("toggle-me");
		expect(service.getJob("toggle-me")?.enabled).toBe(false);
		service.enableJob("toggle-me");
		expect(service.getJob("toggle-me")?.enabled).toBe(true);
		expect(service.removeJob("toggle-me")).toBe(true);
		expect(service.getJob("toggle-me")).toBeNull();
	});

});
