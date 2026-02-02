import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa cron CLI", () => {
	let dir: string;
	let dbPath: string;

	const runCron = async (extraArgs: string[]) => {
		return await execa("bun", [binPath, "cron", ...extraArgs], {
			reject: false,
			env: { ...process.env, NOOA_DB_PATH: dbPath },
		});
	};

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "nooa-cron-"));
		dbPath = join(dir, "cron.db");
	});

	afterEach(async () => {
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
});
