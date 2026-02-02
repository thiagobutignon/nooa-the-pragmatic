import { Database } from "bun:sqlite";
import { expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

let tempDir: string;
let mockDbPath: string;

beforeAll(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "nooa-ai-mcp-"));
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
    VALUES ('mock', 'Mock MCP', 'mock', 'node', '["mock"]', 1);
  `);
	db.close();
});

afterAll(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

test("nooa ai can invoke an MCP tool", async () => {
	const env = {
		...baseEnv,
		NOOA_DB_PATH: mockDbPath,
		MCP_MOCK_RESPONSE: JSON.stringify({
			message: "hello",
		}),
	};

	const res = await execa(
		bunPath,
		[
			"index.ts",
			"ai",
			"hello",
			"--mcp-source",
			"mock",
			"--mcp-tool",
			"echo",
			"--mcp-args",
			`{"message":"hello"}`,
			"--json",
		],
		{ env, cwd: repoRoot, timeout: 3000, reject: false },
	);

	expect(res.exitCode).toBe(0);
	const output = JSON.parse(res.stdout);
	expect(output.server).toBe("mock");
	expect(output.tool).toBe("echo");
	expect(output.result).toBeDefined();
	expect(output.result.message).toBe("hello");
});
