import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { resourceCommand } from "./resource";
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

test("nooa mcp resource reads a resource URI", async () => {
	const { dir, dbPath } = await createTempMcpDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await seedMockServer(dbPath);
		const { exitCode, output } = await captureLog(() =>
			resourceCommand([
				"mock",
				"file:///workspace/README.md",
				"--json",
			]),
		);
		expect(exitCode).toBe(0);
		const result = JSON.parse(output);
		expect(result.contents?.[0]?.text).toContain("Sample resource content");
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
});
