import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { Registry } from "../../core/mcp/Registry";
import { initCommand } from "./init";
import { createTempMcpDb } from "./test-utils";

async function withDb(fn: (dbPath: string) => Promise<void>) {
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

async function captureLog(fn: () => Promise<number>) {
	const logs: string[] = [];
	const originalLog = console.log;
	console.log = (...args: string[]) => logs.push(args.join(" "));
	try {
		const exitCode = await fn();
		return { exitCode, output: logs.join("\n") };
	} finally {
		console.log = originalLog;
	}
}

test("nooa mcp init installs recommended MCPs", async () => {
	await withDb(async (dbPath) => {
		const { exitCode } = await captureLog(() => initCommand([]));
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const fs = await registry.get("filesystem");
		expect(fs).toBeDefined();
		const gh = await registry.get("github");
		expect(gh).toBeDefined();
	});
});

test("nooa mcp init respects --skip-github", async () => {
	await withDb(async (dbPath) => {
		const { exitCode } = await captureLog(() => initCommand(["--skip-github"]));
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const fs = await registry.get("filesystem");
		expect(fs).toBeDefined();
		const gh = await registry.get("github");
		expect(gh).toBeUndefined();
	});
});

test("nooa mcp init --github-token configures GitHub env", async () => {
	await withDb(async (dbPath) => {
		const token = "ghp_test";
		const { exitCode } = await captureLog(() =>
			initCommand(["--github-token", token, "--force"]),
		);
		expect(exitCode).toBe(0);
		const registry = new Registry(new Database(dbPath));
		const gh = await registry.get("github");
		expect(gh?.env?.GITHUB_TOKEN).toBe(token);
	});
});
