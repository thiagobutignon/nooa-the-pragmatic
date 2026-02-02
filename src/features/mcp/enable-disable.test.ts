import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { Registry } from "../../core/mcp/Registry";
import { disableCommand } from "./disable";
import { enableCommand } from "./enable";
import { createTempMcpDb, seedMockServer } from "./test-utils";

async function withDbPath(fn: (dbPath: string) => Promise<void>) {
	const { dir, dbPath } = await createTempMcpDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await fn(dbPath);
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
}

test("nooa mcp enable toggles a disabled MCP", async () => {
	await withDbPath(async (dbPath) => {
		await seedMockServer(dbPath, { enabled: false });
		const exitCode = await enableCommand(["mock"]);
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("mock");
		expect(server?.enabled).toBe(true);
	});
});

test("nooa mcp disable turns off an enabled MCP", async () => {
	await withDbPath(async (dbPath) => {
		await seedMockServer(dbPath, { enabled: true });
		const exitCode = await disableCommand(["mock"]);
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("mock");
		expect(server?.enabled).toBe(false);
	});
});
