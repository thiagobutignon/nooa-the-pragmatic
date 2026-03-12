import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFakeDebugAdapter } from "./adapters/fake";
import { runDebug } from "./execute";

const roots: string[] = [];

async function makeRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-debug-state-"));
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

describe("debug state inspection", () => {
	test("state returns source vars and stack when paused", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "state", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.state).toBe("paused");
			expect(result.data.source?.length).toBeGreaterThan(0);
			expect(result.data.vars?.[0]?.ref).toBe("@v1");
			expect(result.data.stack?.[0]?.ref).toBe("@f0");
		}

		await cleanupRoots();
	});

	test("vars returns locals only", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "vars", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.vars?.length).toBeGreaterThan(0);
			expect(result.data.stack).toBeUndefined();
		}

		await cleanupRoots();
	});
});
