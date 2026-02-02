import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { Registry } from "../../core/mcp/Registry";
import { aliasCommand } from "./alias";
import { createTempMcpDb } from "./test-utils";

async function withDb(fn: (dbPath: string, dir: string) => Promise<void>) {
	const { dir, dbPath } = await createTempMcpDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await fn(dbPath, dir);
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
}

async function captureLog(fn: () => Promise<number>) {
	const logs: string[] = [];
	const originalLog = console.log;
	const originalError = console.error;
	console.log = (...args: string[]) => logs.push(args.join(" "));
	console.error = (...args: string[]) => logs.push(args.join(" "));
	try {
		const exitCode = await fn();
		return { exitCode, output: logs.join("\n") };
	} finally {
		console.log = originalLog;
		console.error = originalError;
	}
}

test("alias create/list/delete flow", async () => {
	await withDb(async (dbPath) => {
		const { exitCode, output } = await captureLog(() =>
			aliasCommand([
				"create",
				"deploy",
				"--command",
				"mcp",
				"--args",
				"call",
				"--args",
				"deploy",
				"--env",
				"NODE_ENV=prod",
			]),
		);
		expect(exitCode).toBe(0);
		expect(output).toContain('Alias "deploy" saved');

		const registry = new Registry(new Database(dbPath));
		const alias = await registry.aliasGet("deploy");
		expect(alias?.command).toBe("mcp");
		expect(alias?.args).toEqual(["call", "deploy"]);
		expect(alias?.env?.NODE_ENV).toBe("prod");

		const listResult = await captureLog(() => aliasCommand(["list"]));
		expect(listResult.exitCode).toBe(0);
		expect(listResult.output).toContain("deploy");

		const deleteResult = await captureLog(() =>
			aliasCommand(["delete", "deploy"]),
		);
		expect(deleteResult.exitCode).toBe(0);
		expect(deleteResult.output).toContain('Alias "deploy" removed');

		const removed = await registry.aliasGet("deploy");
		expect(removed).toBeUndefined();
	});
});

test("list shows json output when --json", async () => {
	await withDb(async (dbPath) => {
		const registry = new Registry(new Database(dbPath));
		await registry.aliasCreate("list-test", "mcp", ["call"], {
			description: "desc",
		});
		const result = await captureLog(() => aliasCommand(["list", "--json"]));
		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed[0].name).toBe("list-test");
	});
});
