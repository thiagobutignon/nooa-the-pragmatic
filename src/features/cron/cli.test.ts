import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa cron CLI", () => {
	let dir: string;
	let dbPath: string;
	let pidPath: string;

	const runCron = async (extraArgs: string[]) => {
		return await execa("bun", [binPath, "cron", ...extraArgs], {
			reject: false,
			env: {
				...baseEnv,
				NOOA_DB_PATH: dbPath,
				NOOA_CRON_DAEMON_PID_PATH: pidPath,
				NOOA_CRON_DAEMON_POLL_MS: "100",
				NOOA_HEARTBEAT_ENABLED: "0",
			},
		});
	};

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "nooa-cron-"));
		dbPath = join(dir, "cron.db");
		pidPath = join(dir, "cron-daemon.pid");
	});

	afterEach(async () => {
		await runCron(["--daemon", "stop", "--json"]);
		await rm(dir, { recursive: true, force: true });
	});

	test("shows help output", async () => {
		const { stdout, exitCode } = await runCron(["--help"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage: nooa cron");
	});

	test("add and lists jobs", async () => {
		const jobName = "daily-index";
		const add = await runCron([
			"add",
			jobName,
			"--every",
			"6h",
			"--",
			"echo",
			"index",
		]);
		expect(add.exitCode).toBe(0);
		expect(add.stdout).toContain("scheduled for '6h'");

		const list = await runCron(["list"]);
		expect(list.exitCode).toBe(0);
		expect(list.stdout).toContain(jobName);
	});

	test("list --json returns structured data", async () => {
		await runCron(["add", "status-job", "--every", "1h", "--", "true"]);
		const list = await runCron(["list", "--json"]);
		expect(list.exitCode).toBe(0);
		const payload = JSON.parse(list.stdout);
		expect(payload.jobs).toHaveLength(1);
		expect(payload.jobs[0].name).toBe("status-job");
	});

	test("status, run, logs, and history work end-to-end", async () => {
		const jobName = "runner";
		await runCron(["add", jobName, "--every", "@daily", "--", "echo", "ok"]);
		const run = await runCron(["run", jobName, "--force"]);
		expect(run.exitCode).toBe(0);
		expect(run.stdout).toContain("executed");

		const status = await runCron(["status", jobName, "--json"]);
		expect(status.exitCode).toBe(0);
		const statusPayload = JSON.parse(status.stdout);
		expect(statusPayload.job).toBeDefined();

		const logs = await runCron(["logs", jobName, "--json"]);
		expect(logs.exitCode).toBe(0);
		const logsPayload = JSON.parse(logs.stdout);
		expect(logsPayload.logs.length).toBeGreaterThan(0);

		const history = await runCron(["history", jobName, "--json"]);
		expect(history.exitCode).toBe(0);
		const historyPayload = JSON.parse(history.stdout);
		expect(historyPayload.logs.length).toBeGreaterThan(0);
	});

	test("edit and remove commands enforce force and updates", async () => {
		const jobName = "cleanup";
		await runCron([
			"add",
			jobName,
			"--every",
			"0 3 * * *",
			"--",
			"echo",
			"cleanup",
		]);
		const edit = await runCron([
			"edit",
			jobName,
			"--schedule",
			"0 4 * * *",
			"--description",
			"updated",
		]);
		expect(edit.exitCode).toBe(0);
		expect(edit.stdout).toContain("updated");

		const removeFail = await runCron(["remove", jobName]);
		expect(removeFail.exitCode).toBe(2);

		const remove = await runCron(["remove", jobName, "--force"]);
		expect(remove.exitCode).toBe(0);
		expect(remove.stdout).toContain("removed");

		const status = await runCron(["status", jobName]);
		expect(status.exitCode).toBe(1);
	});

	test("daemon start/stop/status via --daemon flag", async () => {
		const statusBefore = await runCron(["--daemon", "status", "--json"]);
		expect(statusBefore.exitCode).toBe(0);
		const beforePayload = JSON.parse(statusBefore.stdout);
		expect(beforePayload.daemon.running).toBe(false);

		const start = await runCron(["--daemon", "start", "--json"]);
		expect(start.exitCode).toBe(0);
		const startPayload = JSON.parse(start.stdout);
		expect(startPayload.daemon.running).toBe(true);

		const statusAfter = await runCron(["--daemon", "status", "--json"]);
		expect(statusAfter.exitCode).toBe(0);
		const afterPayload = JSON.parse(statusAfter.stdout);
		expect(afterPayload.daemon.running).toBe(true);

		const stop = await runCron(["--daemon", "stop", "--json"]);
		expect(stop.exitCode).toBe(0);
		const stopPayload = JSON.parse(stop.stdout);
		expect(stopPayload.daemon.running).toBe(false);
	});
});
