import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getBenchPath,
	loadBench,
	saveBench,
	type BenchArtifact,
} from "./storage";

const roots: string[] = [];

async function createRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "nooa-bench-"));
	roots.push(root);
	return root;
}

describe("bench storage", () => {
	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("stores benches under .nooa/bench/<benchId>.json", async () => {
		const root = await createRoot();
		expect(getBenchPath(root, "bench_123")).toBe(
			join(root, ".nooa", "bench", "bench_123.json"),
		);
	});

	test("loadBench returns null when the bench file does not exist", async () => {
		const root = await createRoot();
		expect(await loadBench(root, "missing")).toBeNull();
	});

	test("saveBench persists and loadBench restores the artifact", async () => {
		const root = await createRoot();
		const bench: BenchArtifact = {
			benchId: "bench_abc",
			command: ["node", "script.js"],
			cwd: root,
			runs: 3,
			startedAt: "2026-03-12T08:00:00.000Z",
			finishedAt: "2026-03-12T08:00:03.000Z",
			durationStats: {
				minMs: 100,
				medianMs: 120,
				maxMs: 150,
			},
			successRate: 1,
			traceIds: ["t1", "t2", "t3"],
		};

		await saveBench(root, bench);
		expect(await loadBench(root, bench.benchId)).toEqual(bench);
	});
});
