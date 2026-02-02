import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { CronStore } from "./cron_store";

describe("CronStore", () => {
	let db: Database;
	let store: CronStore;

	beforeEach(() => {
		db = new Database(":memory:");
		store = new CronStore(db);
	});

	test("creates the cron_jobs table and persists jobs", async () => {
		await store.createJob({
			name: "maintenance",
			schedule: "0 2 * * *",
			command: "echo keep",
			description: "daily maintenance",
			retries: 1,
			on_failure: "retry",
		});

		const jobs = store.listJobs();
		expect(jobs.length).toBe(1);
		expect(jobs[0]).toMatchObject({
			name: "maintenance",
			command: "echo keep",
			schedule: "0 2 * * *",
			description: "daily maintenance",
			retries: 1,
			on_failure: "retry",
			enabled: true,
		});
	});

	test("getByName returns the job when exists", async () => {
		await store.createJob({
			name: "run-now",
			schedule: "* * * * *",
			command: "echo now",
		});
		const job = store.getByName("run-now");
		expect(job).toBeDefined();
		expect(job?.name).toBe("run-now");
	});

	test("delete and toggle jobs behave consistently", async () => {
		await store.createJob({
			name: "cleanup",
			schedule: "0 0 * * *",
			command: "echo clean",
		});
		expect(store.listJobs()).toHaveLength(1);
		store.toggleJobByName("cleanup", false);
		expect(store.getByName("cleanup")?.enabled).toBe(false);
		store.toggleJobByName("cleanup", true);
		expect(store.getByName("cleanup")?.enabled).toBe(true);
		expect(store.deleteJobByName("cleanup")).toBe(true);
		expect(store.getByName("cleanup")).toBeNull();
	});

	test("recordExecution logs runs and listLogs returns entries", async () => {
		await store.createJob({
			name: "runner",
			schedule: "@daily",
			command: "echo run",
		});
		const log = store.recordExecution("runner", "success", {
			output: "ok",
			durationMs: 120,
		});
		expect(log).toBeDefined();
		const logs = store.listLogs("runner", 5);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			job_name: "runner",
			status: "success",
			output: "ok",
		});
	});
});
