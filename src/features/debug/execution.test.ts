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

describe("debug execution control", () => {
	test("continue moves a paused fake session into running", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "continue", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.state).toBe("running");
		}

		await cleanupRoots();
	});

	test("step over keeps the fake session paused and advances line", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "step", target: "over", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.line).toBe(3);
		}

		await cleanupRoots();
	});

	test("step into keeps the fake session paused and enters the next frame", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "step", target: "into", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.line).toBe(2);
		}

		await cleanupRoots();
	});

	test("step out keeps the fake session paused and exits the current frame", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "step", target: "out", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.line).toBe(4);
		}

		await cleanupRoots();
	});

	test("run-to pauses a fake session at the requested location", async () => {
		const root = await makeRoot();
		const adapter = createFakeDebugAdapter("node");

		await runDebug(
			{ action: "launch", command: ["node", "app.js"], brk: true, cwd: root },
			() => adapter,
		);

		const result = await runDebug(
			{ action: "run-to", target: "src/app.ts:42", cwd: root },
			() => adapter,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("run-to");
			expect(result.data.state).toBe("paused");
			expect(result.data.stack?.[0]?.file).toBe("src/app.ts");
			expect(result.data.stack?.[0]?.line).toBe(42);
		}

		await cleanupRoots();
	});
});
