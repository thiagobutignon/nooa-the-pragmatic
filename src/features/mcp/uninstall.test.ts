import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { uninstallCommand } from "./uninstall";
import { createTempMcpDb, seedMockServer } from "./test-utils";
import { Database } from "bun:sqlite";
import { Registry } from "../../core/mcp/Registry";

async function withDbPath(fn: (dbPath: string) => Promise<void>) {
	const { dir, dbPath } = await createTempMcpDb();
	const prev = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await fn(dbPath);
	} finally {
		process.env.NOOA_DB_PATH = prev;
		await rm(dir, { recursive: true, force: true });
	}
}

test("nooa mcp uninstall removes an entry", async () => {
	await withDbPath(async (dbPath) => {
		await seedMockServer(dbPath);
		const exitCode = await uninstallCommand(["mock", "--json"]);
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("mock");
		expect(server).toBeUndefined();
	});
});
