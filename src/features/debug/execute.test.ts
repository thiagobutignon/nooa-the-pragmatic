import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFakeDebugAdapter } from "./adapters/fake";
import { runDebug } from "./execute";

const roots: string[] = [];

async function makeRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-debug-exec-"));
	roots.push(root);
	return root;
}

async function cleanupRoots() {
	await Promise.all(
		roots.splice(0, roots.length).map((root) =>
			rm(root, { recursive: true, force: true }),
		),
	);
}

describe("debug execute", () => {
	test("launch stores a session using the selected adapter", async () => {
		const root = await makeRoot();

		const result = await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("launch");
			expect(result.data.state).toBe("paused");
			expect(result.data.runtime).toBe("node");
			expect(result.data.target?.pid).toBe(99999);
		}

		await cleanupRoots();
	});

	test("status returns no_active_session when nothing has been launched", async () => {
		const root = await makeRoot();
		const result = await runDebug(
			{
				action: "status",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("debug.no_active_session");
		}

		await cleanupRoots();
	});

	test("inspect-at captures a paused snapshot in one atomic operation", async () => {
		const root = await makeRoot();

		const result = await runDebug(
			{
				action: "inspect-at",
				target: "src/app.ts:42",
				command: ["node", "app.js"],
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("inspect-at");
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.file).toBe("src/app.ts");
			expect(result.data.stack?.[0]?.line).toBe(42);
			expect(result.data.breakpoints?.[0]?.ref).toBe("BP#1");
			expect(result.data.source?.length).toBeGreaterThan(0);
			expect(result.data.target).toBeUndefined();
		}

		await cleanupRoots();
	});

	test("inspect-on-failure captures a paused snapshot in one atomic operation", async () => {
		const root = await makeRoot();

		const result = await runDebug(
			{
				action: "inspect-on-failure",
				command: ["node", "app.js"],
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("inspect-on-failure");
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.line).toBeGreaterThan(0);
			expect(result.data.source?.length).toBeGreaterThan(0);
			expect(result.data.target).toBeUndefined();
			expect(result.data.exception?.message).toContain("boom");
			expect(result.data.exception?.reason).toBe("exception");
		}

		await cleanupRoots();
	});

	test("capture returns a startup snapshot in one atomic operation", async () => {
		const root = await makeRoot();

		const result = await runDebug(
			{
				action: "capture",
				command: ["node", "app.js"],
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("capture");
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.line).toBeGreaterThan(0);
			expect(result.data.source?.length).toBeGreaterThan(0);
			expect(result.data.target).toBeUndefined();
		}

		await cleanupRoots();
	});

	test("inspect-test-failure captures failure evidence from a test command", async () => {
		const root = await makeRoot();

		const result = await runDebug(
			{
				action: "inspect-test-failure",
				command: ["bun", "test", "tests/failing.fixture.ts"],
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
			async () => ({
				exitCode: 1,
				stdout: "",
				stderr: [
					"tests/failing.fixture.ts:",
					'error: expect(received).toBe(expected)',
					"Expected: 2",
					"Received: 1",
					"",
					"      at <anonymous> (/tmp/work/tests/failing.fixture.ts:4:13)",
				].join("\n"),
			}),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("inspect-test-failure");
			expect(result.data.state).toBe("failed");
			expect(result.data.stack?.[0]?.file).toBe("/tmp/work/tests/failing.fixture.ts");
			expect(result.data.stack?.[0]?.line).toBe(4);
			expect(result.data.exception?.reason).toBe("test_failure");
			expect(result.data.exception?.message).toContain("expect(received).toBe");
			expect(result.data.target).toBeUndefined();
		}

		await cleanupRoots();
	});

	test("pause persists a running session as paused", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: false,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const result = await runDebug(
			{
				action: "pause",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("pause");
			expect(result.data.state).toBe("paused");
			expect(result.data.source?.length).toBeGreaterThan(0);
			expect(result.data.stack?.[0]?.ref).toBe("@f0");
		}

		await cleanupRoots();
	});

	test("source returns the current paused source snippet", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const result = await runDebug(
			{
				action: "source",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("source");
			expect(result.data.state).toBe("paused");
			expect(result.data.source?.[0]).toContain("const foo");
			expect(result.data.stack?.[0]?.ref).toBe("@f0");
		}

		await cleanupRoots();
	});

	test("source resolves a frame ref target", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const stateResult = await runDebug(
			{
				action: "state",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);
		expect(stateResult.ok).toBe(true);

		const result = await runDebug(
			{
				action: "source",
				target: "@f0",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("source");
			expect(result.data.source?.[0]).toContain("const foo");
		}

		await cleanupRoots();
	});

	test("scripts returns known loaded scripts for a session", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const result = await runDebug(
			{
				action: "scripts",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("scripts");
			expect(result.data.scripts?.[0]?.url).toContain("app.js");
		}

		await cleanupRoots();
	});

	test("props expands object refs captured from vars", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const varsResult = await runDebug(
			{
				action: "vars",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(varsResult.ok).toBe(true);
		if (varsResult.ok) {
			expect(varsResult.data.vars?.find((value) => value.name === "bar")?.ref).toBe(
				"@v2",
			);
		}

		const propsResult = await runDebug(
			{
				action: "props",
				target: "@v2",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(propsResult.ok).toBe(true);
		if (propsResult.ok) {
			expect(propsResult.data.mode).toBe("props");
			expect(propsResult.data.vars?.map((value) => value.name)).toEqual([
				"nested",
				"count",
			]);
		}

		await cleanupRoots();
	});

	test("console returns the latest structured console entries for a session", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const result = await runDebug(
			{
				action: "console",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("console");
			expect(result.data.console?.[0]?.level).toBe("log");
			expect(result.data.console?.[0]?.text).toContain("fake console");
		}

		await cleanupRoots();
	});

	test("exceptions returns no exception when nothing has been captured", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const result = await runDebug(
			{
				action: "exceptions",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("exceptions");
			expect(result.data.exception).toBeUndefined();
			expect(result.data.raw).toContain("No exception");
		}

		await cleanupRoots();
	});

	test("catch stores the requested exception pause mode in the session", async () => {
		const root = await makeRoot();

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		const result = await runDebug(
			{
				action: "catch",
				target: "all",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("catch");
			expect(result.data.raw).toContain("all");
		}

		const exceptions = await runDebug(
			{
				action: "exceptions",
				cwd: root,
			},
			() => createFakeDebugAdapter("node"),
		);

		expect(exceptions.ok).toBe(true);
		if (exceptions.ok) {
			expect(exceptions.data.raw).toContain("all");
		}

		await cleanupRoots();
	});

	test("set updates a paused expression and returns the new value", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{
				action: "launch",
				command: ["node", "app.js"],
				brk: true,
				cwd: root,
			},
			() => adapter,
		);

		const result = await runDebug(
			{
				action: "set",
				target: "bar.count",
				expression: "7",
				cwd: root,
			},
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("set");
			expect(result.data.result?.value).toBe("7");
		}

		await cleanupRoots();
	});
});
