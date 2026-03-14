import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFakeDebugAdapter } from "./adapters/fake";
import { runDebug } from "./execute";

const roots: string[] = [];

async function makeRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-debug-break-"));
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

describe("debug breakpoints", () => {
	test("break persists a breakpoint with a stable BP ref", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "break", target: "src/app.ts:42", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.breakpoints?.[0]?.ref).toBe("BP#1");
		}

		await cleanupRoots();
	});

	test("break-ls returns the stored breakpoints", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);
		await runDebug(
			{ action: "break", target: "src/app.ts:42", cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "break-ls", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.breakpoints?.length).toBe(1);
		}

		await cleanupRoots();
	});

	test("break-toggle removes an existing breakpoint and recreates it on the next toggle", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);
		await runDebug(
			{ action: "break", target: "src/app.ts:42", cwd: root },
			() => adapter,
		);

		const removed = await runDebug(
			{ action: "break-toggle", target: "src/app.ts:42", cwd: root },
			() => adapter,
		);
		expect(removed.ok).toBe(true);
		if (removed.ok) {
			expect(removed.data.breakpoints?.length).toBe(0);
			expect(removed.data.raw).toContain("removed");
		}

		const added = await runDebug(
			{ action: "break-toggle", target: "src/app.ts:42", cwd: root },
			() => adapter,
		);
		expect(added.ok).toBe(true);
		if (added.ok) {
			expect(added.data.breakpoints?.[0]?.ref).toBe("BP#1");
			expect(added.data.raw).toContain("set");
		}

		await cleanupRoots();
	});

	test("logpoint persists a logpoint with a stable BP ref", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{
				action: "logpoint",
				target: "src/app.ts:42",
				expression: "foo={foo}",
				cwd: root,
			},
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.breakpoints?.[0]?.ref).toBe("BP#1");
			expect(result.data.raw).toContain("logpoint");
		}

		const listed = await runDebug(
			{ action: "break-ls", cwd: root },
			() => adapter,
		);
		expect(listed.ok).toBe(true);
		if (listed.ok) {
			expect(listed.data.breakpoints?.[0]?.ref).toBe("BP#1");
		}

		await cleanupRoots();
	});
});
