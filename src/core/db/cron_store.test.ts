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
});
