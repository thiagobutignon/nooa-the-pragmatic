import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createTempMcpDb, seedMockServer } from "../../features/mcp/test-utils";
import { Registry } from "./Registry";

async function withDb(fn: (dbPath: string) => Promise<void>) {
	const { dir, dbPath } = await createTempMcpDb();
	try {
		await fn(dbPath);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("Registry.healthCheck returns healthy status", async () => {
	await withDb(async (dbPath) => {
		await seedMockServer(dbPath);
		const db = new Database(dbPath);
		const registry = new Registry(db);

		const status = await registry.healthCheck("mock");
		expect(status.status).toBe("healthy");
		expect(status.latency).toBeGreaterThanOrEqual(0);
		expect(status.lastCheck).toBeGreaterThan(0);
		db.close();
	});
});

test("Registry.healthCheck marks disabled servers as down", async () => {
	await withDb(async (dbPath) => {
		await seedMockServer(dbPath, { enabled: false });
		const db = new Database(dbPath);
		const registry = new Registry(db);

		const status = await registry.healthCheck("mock");
		expect(status.status).toBe("down");
		expect(status.reason).toBe("disabled");
		db.close();
	});
});
