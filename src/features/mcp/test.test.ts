import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { testCommand } from "./test";
import { createTempMcpDb, seedMockServer } from "./test-utils";

async function captureJson(fn: () => Promise<number>) {
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

async function withDb(fn: (dbPath: string) => Promise<void>) {
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

test("nooa mcp test checks server health", async () => {
	await withDb(async (dbPath) => {
		await seedMockServer(dbPath);
		const { exitCode, output } = await captureJson(() =>
			testCommand(["mock", "--json"]),
		);
		expect(exitCode).toBe(0);
		const res = JSON.parse(output);
		expect(res.name).toBe("mock");
		expect(res.ok).toBe(true);
	});
});
