import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type DebugSessionRecord,
	createDebugSession,
	deleteDebugSession,
	getDebugSessionsPath,
	loadDebugSession,
	loadDebugSessions,
	saveDebugSession,
} from "./store";

async function makeRoot() {
	return await mkdtemp(join(process.env.TMPDIR ?? "/tmp", "nooa-debug-"));
}

async function withRoot(run: (root: string) => Promise<void>) {
	const root = await makeRoot();
	try {
		await run(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

describe("debug session store", () => {
	test("getDebugSessionsPath stores state under .nooa/debug", () => {
		const root = "/tmp/example";
		expect(getDebugSessionsPath(root)).toBe("/tmp/example/.nooa/debug/sessions.json");
	});

	test("loadDebugSessions returns empty object when state file does not exist", async () => {
		await withRoot(async (root) => {
			const state = await loadDebugSessions(root);
			expect(state.sessions).toEqual({});
		});
	});

	test("loadDebugSessions returns empty object when state file is invalid JSON", async () => {
		await withRoot(async (root) => {
			const debugDir = join(root, ".nooa", "debug");
			await mkdir(debugDir, { recursive: true });
			await writeFile(join(debugDir, "sessions.json"), "template");

			const state = await loadDebugSessions(root);
			expect(state.sessions).toEqual({});
		});
	});

	test("createDebugSession creates a named idle session", async () => {
		await withRoot(async (root) => {
			const created = await createDebugSession(root, {
				name: "default",
				runtime: "node",
			});

			expect(created.name).toBe("default");
			expect(created.runtime).toBe("node");
			expect(created.state).toBe("idle");
			expect(created.breakpoints).toEqual([]);
			expect(created.refs).toEqual({
				frames: [],
				values: [],
				breakpoints: [],
			});

			const loaded = await loadDebugSession(root, "default");
			expect(loaded).not.toBeNull();
			expect(loaded?.name).toBe("default");
		});
	});

	test("saveDebugSession updates an existing session state", async () => {
		await withRoot(async (root) => {
			const created = await createDebugSession(root, {
				name: "default",
				runtime: "node",
			});

			const updated: DebugSessionRecord = {
				...created,
				state: "paused",
				target: {
					command: ["node", "app.js"],
					pid: 1234,
				},
				location: {
					file: "src/app.ts",
					line: 42,
					column: 7,
				},
			};

			await saveDebugSession(root, updated);

			const loaded = await loadDebugSession(root, "default");
			expect(loaded?.state).toBe("paused");
			expect(loaded?.target?.pid).toBe(1234);
			expect(loaded?.location?.line).toBe(42);
		});
	});

	test("deleteDebugSession removes the session from state", async () => {
		await withRoot(async (root) => {
			await createDebugSession(root, {
				name: "default",
				runtime: "bun",
			});

			await deleteDebugSession(root, "default");

			const loaded = await loadDebugSession(root, "default");
			expect(loaded).toBeNull();
		});
	});
});
