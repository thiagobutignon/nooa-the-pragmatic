import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getRecordPath,
	loadRecord,
	saveRecord,
	type RecordArtifact,
} from "./storage";

const roots: string[] = [];

async function createRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "nooa-record-"));
	roots.push(root);
	return root;
}

describe("record storage", () => {
	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("stores records under .nooa/records/<recordId>.json", async () => {
		const root = await createRoot();
		expect(getRecordPath(root, "record_123")).toBe(
			join(root, ".nooa", "records", "record_123.json"),
		);
	});

	test("loadRecord returns null when the record file does not exist", async () => {
		const root = await createRoot();
		expect(await loadRecord(root, "missing")).toBeNull();
	});

	test("saveRecord persists and loadRecord restores the artifact", async () => {
		const root = await createRoot();
		const record: RecordArtifact = {
			recordId: "record_abc",
			traceId: "trace_abc",
			command: ["node", "script.js"],
			cwd: root,
			startedAt: "2026-03-12T08:00:00.000Z",
			finishedAt: "2026-03-12T08:00:01.000Z",
			durationMs: 1000,
			exitCode: 0,
			signal: null,
			stdout: "ok",
			stderr: "",
			filesTouched: ["tmp/output.txt"],
		};

		await saveRecord(root, record);
		expect(await loadRecord(root, record.recordId)).toEqual(record);
	});
});
