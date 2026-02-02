import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { Registry } from "../../core/mcp/Registry";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

async function setupMcpServer(dbPath: string) {
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

test("nooa ai can invoke an MCP tool", async () => {
	const dir = await mkdtemp(join(tmpdir(), "nooa-ai-mcp-"));
	const dbPath = join(dir, "nooa.db");
	try {
		await setupMcpServer(dbPath);
		const env = { ...baseEnv, NOOA_DB_PATH: dbPath };

		const res = await execa(
			bunPath,
			[
				"index.ts",
				"ai",
				"call",
				"--mcp-source",
				"mock",
				"--mcp-tool",
				"echo",
				"--mcp-args",
				`{"message":"hello"}`,
				"--json",
			],
			{ env, cwd: repoRoot },
		);

		expect(res.exitCode).toBe(0);
		const output = JSON.parse(res.stdout);
		expect(output.server).toBe("mock");
		expect(output.tool).toBe("echo");
		expect(output.result).toBeDefined();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
