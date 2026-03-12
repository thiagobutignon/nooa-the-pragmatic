import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getTracePath,
	loadTrace,
	saveTrace,
	type TraceArtifact,
} from "./storage";

const roots: string[] = [];

async function createRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "nooa-trace-"));
	roots.push(root);
	return root;
}

describe("trace storage", () => {
	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("stores traces under .nooa/traces/<traceId>.json", async () => {
		const root = await createRoot();
		expect(getTracePath(root, "trace_123")).toBe(
			join(root, ".nooa", "traces", "trace_123.json"),
		);
	});

	test("loadTrace returns null when the trace file does not exist", async () => {
		const root = await createRoot();
		expect(await loadTrace(root, "missing")).toBeNull();
	});

	test("saveTrace persists and loadTrace restores the artifact", async () => {
		const root = await createRoot();
		const trace: TraceArtifact = {
			traceId: "trace_abc",
			parentTraceId: null,
			spanId: "span_1",
			command: ["node", "script.js"],
			cwd: root,
			startedAt: "2026-03-12T08:00:00.000Z",
			finishedAt: "2026-03-12T08:00:01.000Z",
			durationMs: 1000,
			exitCode: 0,
			signal: null,
			stdoutSummary: "ok",
			stderrSummary: "",
			subprocesses: [],
			filesTouched: ["tmp/output.txt"],
			links: {},
		};

		await saveTrace(root, trace);
		expect(await loadTrace(root, trace.traceId)).toEqual(trace);
	});
});
