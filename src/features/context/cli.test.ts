import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

let tempDir: string;
let mockDbPath: string;

beforeAll(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "nooa-context-mcp-"));
	mockDbPath = join(tempDir, "nooa.db");
	const db = new Database(mockDbPath, { create: true });
	db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT,
      package TEXT,
      command TEXT,
      args TEXT,
      enabled INTEGER
    );
  `);
	db.exec(`
    INSERT OR REPLACE INTO mcp_servers
    (id, name, package, command, args, enabled)
    VALUES ('mock', 'mock-mcp', 'mock', 'node', '[]', 1);
  `);
	db.close();
});

afterAll(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

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
		const env = { ...baseEnv, NOOA_DB_PATH: mockDbPath };
		const { stdout, exitCode } = await execa(
			bunPath,
			["index.ts", "context", "src/core/logger.ts", "--json", "--include-mcp"],
			{ env, cwd: repoRoot, timeout: 10000 },
		);
		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("mcpResources");
		expect(Array.isArray(result.mcpResources)).toBe(true);
		expect(result.mcpResources.length).toBeGreaterThan(0);
		expect(result.mcpResources[0]).toHaveProperty("name", "mock-mcp");
	});
});
