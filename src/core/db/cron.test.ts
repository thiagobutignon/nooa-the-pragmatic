import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { setupCronTable } from "./schema/cron";

describe("Cron DB Schema", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
	});

	test("can create cron_jobs and cron_logs tables", () => {
		setupCronTable(db);
		const jobs = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='cron_jobs'",
			)
			.get();
		const logs = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='cron_logs'",
			)
			.get();
		expect(jobs).toBeDefined();
		expect(logs).toBeDefined();
	});
});
