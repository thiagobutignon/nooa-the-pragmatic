import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Registry } from "../../core/mcp/Registry";

import { configureCommand } from "./configure";
import { infoCommand } from "./info";
import { installCommand } from "./install";

async function mkTempDb() {
	const dir = await mkdtemp(join(tmpdir(), "nooa-mcp-"));
	const dbPath = join(dir, "nooa.db");
	return { dir, dbPath };
}

test("nooa mcp install registers an MCP", async () => {
	const { dir, dbPath } = await mkTempDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		const exitCode = await installCommand([
			"@modelcontextprotocol/server-filesystem",
		]);
		expect(exitCode).toBe(0);

		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("server-filesystem");
		expect(server).toBeDefined();
		expect(server?.package).toBe("@modelcontextprotocol/server-filesystem");
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
});

test("nooa mcp info prints saved MCP metadata", async () => {
	const { dir, dbPath } = await mkTempDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await installCommand(["@modelcontextprotocol/server-filesystem"]);

		const exitCode = await infoCommand(["server-filesystem", "--json"]);
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("server-filesystem");
		expect(server?.name).toBe("server-filesystem");
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
});

test("nooa mcp configure updates settings", async () => {
	const { dir, dbPath } = await mkTempDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await installCommand(["@modelcontextprotocol/server-filesystem"]);

		const exitCode = await configureCommand([
			"server-filesystem",
			"--disable",
			"--env",
			"TEST=1",
			"--args",
			"./bin.js",
		]);
		expect(exitCode).toBe(0);

		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("server-filesystem");
		expect(server?.enabled).toBe(false);
		expect(server?.env?.TEST).toBe("1");
		expect(server?.args).toEqual(["./bin.js"]);
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
});
