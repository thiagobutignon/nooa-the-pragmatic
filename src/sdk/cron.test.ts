import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.cron", () => {
	it("adds and lists jobs", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-cron-"));
		const dbPath = join(root, "cron.db");
		const originalDb = process.env.NOOA_DB_PATH;
		process.env.NOOA_DB_PATH = dbPath;
		try {
			const { sdk } = await import("./index");
			const addResult = await sdk.cron.add({
				name: "job",
				schedule: "5m",
				command: "echo hi",
			});
			expect(addResult.ok).toBe(true);

			const listResult = await sdk.cron.list({});
			expect(listResult.ok).toBe(true);
			if (!listResult.ok) {
				throw new Error("Expected ok list result");
			}
			expect(listResult.data.length).toBe(1);
		} finally {
			if (originalDb === undefined) {
				delete process.env.NOOA_DB_PATH;
			} else {
				process.env.NOOA_DB_PATH = originalDb;
			}
			await rm(root, { recursive: true, force: true });
		}
	});
});
