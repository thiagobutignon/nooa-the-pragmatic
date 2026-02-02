import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { healthCommand } from "./health";
import { createTempMcpDb, seedMockServer } from "./test-utils";

async function captureOutput(fn: () => Promise<number>) {
	const logs: string[] = [];
	const errors: string[] = [];
	const originalLog = console.log;
	const originalError = console.error;
	console.log = (...args: string[]) => logs.push(args.join(" "));
	console.error = (...args: string[]) => errors.push(args.join(" "));
	try {
		const exitCode = await fn();
		return { exitCode, stdout: logs.join("\n"), stderr: errors.join("\n") };
	} finally {
		console.log = originalLog;
		console.error = originalError;
	}
}

async function withMcpDb(fn: (dbPath: string) => Promise<void>) {
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

test("nooa mcp health prints error when name missing", async () => {
	const { exitCode, stderr } = await captureOutput(() => healthCommand([]));
	expect(exitCode).toBe(2);
	expect(stderr).toContain("MCP name required");
});

test("nooa mcp health returns healthy status text", async () => {
	await withMcpDb(async (dbPath) => {
		await seedMockServer(dbPath);
		const { exitCode, stdout } = await captureOutput(() =>
			healthCommand(["mock"]),
		);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("status=healthy");
		expect(stdout).toContain("MCP mock");
	});
});

test("nooa mcp health --json returns structured status", async () => {
	await withMcpDb(async (dbPath) => {
		await seedMockServer(dbPath);
		const { exitCode, stdout } = await captureOutput(() =>
			healthCommand(["mock", "--json"]),
		);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.status).toBe("healthy");
		expect(parsed.latency).toBeGreaterThanOrEqual(0);
	});
});
