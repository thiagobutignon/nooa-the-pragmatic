import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFakeDebugAdapter } from "./adapters/fake";
import { runDebug } from "./execute";

const roots: string[] = [];

async function makeRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-debug-eval-"));
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

describe("debug eval", () => {
	test("eval returns fake adapter value", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "eval", expression: "typeof foo", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.result?.value).toContain("fake:typeof foo");
		}

		await cleanupRoots();
	});
});
