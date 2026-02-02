import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { callCommand } from "./call";
import { createTempMcpDb, seedMockServer } from "./test-utils";

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

test("nooa mcp call executes an MCP tool", async () => {
	const { dir, dbPath } = await createTempMcpDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await seedMockServer(dbPath);
		const { exitCode, output } = await captureLog(() =>
			callCommand(["mock", "echo", "--message=hello", "--json"]),
		);
		expect(exitCode).toBe(0);
		const result = JSON.parse(output);
		expect(result.content?.[0]?.text).toBe("hello");
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
});
