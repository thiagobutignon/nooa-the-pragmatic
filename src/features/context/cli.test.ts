import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { Registry } from "../../core/mcp/Registry";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

async function mkTempDb() {
	const dir = await mkdtemp(join(tmpdir(), "nooa-context-mcp-"));
	const dbPath = join(dir, "nooa.db");
	return { dir, dbPath };
}

async function seedMockMcp(dbPath: string) {
	const registry = new Registry(new Database(dbPath));
	await registry.add({
		id: "mock",
		name: "mock",
		package: "mock-mcp-server",
		command: "node",
		args: ["./test/fixtures/mock-mcp-server.cjs"],
		enabled: true,
	});
}

describe("context CLI", () => {
	test("outputs context for a file", async () => {
		const { stdout, exitCode } = await execa(
			bunPath,
			["index.ts", "context", "src/core/logger.ts", "--json"],
			{ reject: false, env: baseEnv, cwd: repoRoot },
		);
		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("target");
	});

	test("includes MCP resources when requested", async () => {
		const { dir, dbPath } = await mkTempDb();
		try {
			await seedMockMcp(dbPath);
			const env = { ...baseEnv, NOOA_DB_PATH: dbPath };
			const { stdout, exitCode } = await execa(
				bunPath,
				[
					"index.ts",
					"context",
					"src/core/logger.ts",
					"--json",
					"--include-mcp",
				],
				{ env, cwd: repoRoot },
			);
			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result).toHaveProperty("mcpResources");
			expect(Array.isArray(result.mcpResources)).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
