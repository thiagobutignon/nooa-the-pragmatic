import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBench } from "./storage";
import { runBenchInspect } from "./execute";

const roots: string[] = [];

async function createRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "nooa-bench-exec-"));
	roots.push(root);
	return root;
}

describe("bench execute", () => {
	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("runs a command multiple times and computes duration statistics", async () => {
		const root = await createRoot();
		const result = await runBenchInspect({
			action: "inspect",
			command: ["node", "-e", "console.log('bench')"],
			runs: 3,
			cwd: root,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data.mode).toBe("inspect");
		expect(result.data.runs).toBe(3);
		expect(result.data.traceIds).toHaveLength(3);
		expect(result.data.successRate).toBe(1);
		expect(result.data.durationStats.minMs).toBeLessThanOrEqual(
			result.data.durationStats.medianMs,
		);
		expect(result.data.durationStats.medianMs).toBeLessThanOrEqual(
			result.data.durationStats.maxMs,
		);

		const stored = await loadBench(root, result.data.benchId);
		expect(stored?.traceIds).toHaveLength(3);
	});

	test("rejects missing commands", async () => {
		const result = await runBenchInspect({
			action: "inspect",
			command: [],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("bench.invalid_target");
		}
	});
});
