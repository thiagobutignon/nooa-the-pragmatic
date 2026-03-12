import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRecord } from "./storage";
import { runRecordInspect } from "./execute";
import { loadTrace } from "../trace/storage";

const roots: string[] = [];

async function createRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "nooa-record-exec-"));
	roots.push(root);
	return root;
}

describe("record execute", () => {
	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("records stdout, stderr, touched files, and trace linkage", async () => {
		const root = await createRoot();
		const result = await runRecordInspect({
			action: "inspect",
			command: [
				"node",
				"-e",
				"require('node:fs').writeFileSync('recorded.txt','ok'); console.log('out-raw-1234567890'); console.error('err-raw-1234567890')",
			],
			cwd: root,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data.mode).toBe("inspect");
		expect(result.data.stdout).toContain("out-raw-1234567890");
		expect(result.data.stderr).toContain("err-raw-1234567890");
		expect(result.data.filesTouched).toContain("recorded.txt");
		expect(result.data.traceId).toBeString();
		expect(result.data.env?.NOOA_DISABLE_REFLECTION).toBe("1");

		const storedRecord = await loadRecord(root, result.data.recordId);
		const storedTrace = await loadTrace(root, result.data.traceId);

		expect(storedRecord?.traceId).toBe(result.data.traceId);
		expect(storedRecord?.env?.NOOA_DISABLE_REFLECTION).toBe("1");
		expect(storedTrace?.links.recordId).toBe(result.data.recordId);
	});

	test("rejects missing commands", async () => {
		const result = await runRecordInspect({
			action: "inspect",
			command: [],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("record.invalid_target");
		}
	});
});
