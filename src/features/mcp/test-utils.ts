import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import { repoRoot } from "../../test-utils/cli-env";
import { Registry } from "../../core/mcp/Registry";

export async function createTempMcpDb() {
	const dir = await mkdtemp(join(tmpdir(), "nooa-mcp-"));
	const dbPath = join(dir, "nooa.db");
	return { dir, dbPath };
}

export async function seedMockServer(
	dbPath: string,
	options: { name?: string; enabled?: boolean } = {},
) {
	const db = new Database(dbPath);
	const registry = new Registry(db);
	const serverName = options.name ?? "mock";
	await registry.add({
		id: randomUUID(),
		name: serverName,
		package: "mock-mcp",
		command: "node",
		args: [join(repoRoot, "test/fixtures/mock-mcp-server.cjs")],
		env: {},
		enabled: options.enabled ?? true,
	});
	db.close();
}
