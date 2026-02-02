import type { Database } from "bun:sqlite";
import { setupCronJobsTable } from "./cron_jobs";
import { setupCronLogsTable } from "./cron_logs";

export function setupCronTable(db: Database) {
	setupCronJobsTable(db);
	setupCronLogsTable(db);
}
