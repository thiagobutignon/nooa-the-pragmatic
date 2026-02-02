import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Registry } from "../../core/mcp/Registry";
import { configureCommand } from "./configure";
import { createTempMcpDb, seedMockServer } from "./test-utils";

async function withDb(fn: (dbPath: string, dir: string) => Promise<void>) {
	const { dir, dbPath } = await createTempMcpDb();
	const previous = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = dbPath;
	try {
		await fn(dbPath, dir);
	} finally {
		process.env.NOOA_DB_PATH = previous;
		await rm(dir, { recursive: true, force: true });
	}
}

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

test("configure merges env from --env-file", async () => {
	await withDb(async (dbPath, dir) => {
		await seedMockServer(dbPath, { name: "mock" });
		const envPath = join(dir, "secret.env");
		await writeFile(envPath, "EXTRA=magic\n");

		const { exitCode } = await captureLog(() =>
			configureCommand(["mock", "--env-file", envPath]),
		);
		expect(exitCode).toBe(0);

		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("mock");
		expect(server?.env?.EXTRA).toBe("magic");
	});
});

test("configure picks up .mcp.env when present", async () => {
	await withDb(async (dbPath, _dir) => {
		await seedMockServer(dbPath, { name: "mock" });
		const workspace = await mkdtemp(join(tmpdir(), "nooa-configure-"));
		const envPath = join(workspace, ".mcp.env");
		await mkdir(join(workspace, ".git"));
		await writeFile(envPath, "AUTO=1\n");

		const previousCwd = process.cwd();
		process.chdir(workspace);
		try {
			const { exitCode } = await captureLog(() => configureCommand(["mock"]));
			expect(exitCode).toBe(0);
		} finally {
			process.chdir(previousCwd);
			await rm(workspace, { recursive: true, force: true });
		}

		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("mock");
		expect(server?.env?.AUTO).toBe("1");
	});
});

test("configure honors global -> root -> explicit env files", async () => {
	await withDb(async (dbPath, _dir) => {
		await seedMockServer(dbPath, { name: "mock" });
		const workspace = await mkdtemp(join(tmpdir(), "nooa-configure-global-"));
		const project = join(workspace, "project");
		const subdir = join(project, "src");
		await mkdir(subdir, { recursive: true });
		await mkdir(join(project, ".git"), { recursive: true });

		const globalEnv = join(workspace, "global.env");
		const rootEnv = join(project, ".mcp.env");
		const explicitEnv = join(project, "extra.env");

		await writeFile(globalEnv, "GLOBAL=1\nOVERRIDE=global\n");
		await writeFile(rootEnv, "ROOT=2\nOVERRIDE=root\n");
		await writeFile(explicitEnv, "EXTRA=3\nOVERRIDE=explicit\n");

		const previousGlobal = process.env.NOOA_MCP_GLOBAL_ENV_FILE;
		process.env.NOOA_MCP_GLOBAL_ENV_FILE = globalEnv;

		const previousCwd = process.cwd();
		process.chdir(subdir);
		try {
			const { exitCode } = await captureLog(() =>
				configureCommand(["mock", "--env-file", explicitEnv]),
			);
			expect(exitCode).toBe(0);
		} finally {
			process.chdir(previousCwd);
			process.env.NOOA_MCP_GLOBAL_ENV_FILE = previousGlobal;
			await rm(workspace, { recursive: true, force: true });
		}

		const registry = new Registry(new Database(dbPath));
		const server = await registry.get("mock");
		expect(server?.env?.GLOBAL).toBe("1");
		expect(server?.env?.ROOT).toBe("2");
		expect(server?.env?.EXTRA).toBe("3");
		expect(server?.env?.OVERRIDE).toBe("explicit");
	});
});
