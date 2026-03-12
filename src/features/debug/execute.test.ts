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
});
