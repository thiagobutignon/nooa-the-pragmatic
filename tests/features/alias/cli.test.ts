import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { execa } from "execa";

import { aliasCommand } from "../../../src/features/mcp/alias.ts";
import { createTempMcpDb } from "../../../src/features/mcp/test-utils.ts";

async function setupDb() {
	const { dir, dbPath } = await createTempMcpDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	const restore = () => {
		process.env.NOOA_DB_PATH = previous;
	};
	return { dir, dbPath, restore };
}

test("alias dispatches stored command", async () => {
	const { dir, dbPath, restore } = await setupDb();
	try {
		await aliasCommand([
			"create",
			"deploy",
			"--command",
			"mcp",
			"--args",
			"list",
		]);

		const env = { ...process.env, NOOA_DB_PATH: dbPath };
		const { stdout, exitCode } = await execa("bun", ["index.ts", "deploy"], {
			env,
			reject: false,
		});
		expect(exitCode).toBe(0);
		expect(stdout).toContain("No MCPs found");
	} finally {
		restore();
		await rm(dir, { recursive: true, force: true });
	}
});

test("alias appends invocation arguments", async () => {
	const { dir, dbPath, restore } = await setupDb();
	try {
		await aliasCommand([
			"create",
			"json-list",
			"--command",
			"mcp",
			"--args=list",
			"--args=--json",
		]);

		const env = { ...process.env, NOOA_DB_PATH: dbPath };
		const { stdout, exitCode } = await execa(
			"bun",
			["index.ts", "json-list", "--json"],
			{ env, reject: false },
		);

		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed).toEqual([]);
	} finally {
		restore();
		await rm(dir, { recursive: true, force: true });
	}
});
