import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { listCommand } from "./list";
import { createTempMcpDb, seedMockServer } from "./test-utils";

async function captureJsonLog(fn: () => Promise<number>) {
	const logs: string[] = [];
	const originalLog = console.log;
	console.log = (...args: string[]) => {
		logs.push(args.map(String).join(" "));
	};
	try {
		const exitCode = await fn();
		return { exitCode, output: logs.join("\n") };
	} finally {
		console.log = originalLog;
	}
}

async function withDbPath(
	fn: (dbPath: string) => Promise<void>,
) {
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

test("nooa mcp list --installed includes every MCP", async () => {
	await withDbPath(async (dbPath) => {
		await seedMockServer(dbPath, { name: "mock-one", enabled: true });
		await seedMockServer(dbPath, { name: "mock-two", enabled: false });

		const { exitCode, output } = await captureJsonLog(() =>
			listCommand(["--installed", "--json"]),
		);
		expect(exitCode).toBe(0);
		const list = JSON.parse(output);
		expect(list).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "mock-one" }),
				expect.objectContaining({ name: "mock-two" }),
			]),
		);
	});
});

test("nooa mcp list --enabled shows enabled MCPs only", async () => {
	await withDbPath(async (dbPath) => {
		await seedMockServer(dbPath, { name: "mock-enabled", enabled: true });
		await seedMockServer(dbPath, { name: "mock-disabled", enabled: false });

		const { exitCode, output } = await captureJsonLog(() =>
			listCommand(["--enabled", "--json"]),
		);
		expect(exitCode).toBe(0);
		const list = JSON.parse(output);
		expect(list.every((mcp: { enabled: boolean }) => mcp.enabled)).toBe(true);
		expect(list).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "mock-enabled" }),
			]),
		);
		expect(list).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "mock-disabled" }),
			]),
		);
	});
});
