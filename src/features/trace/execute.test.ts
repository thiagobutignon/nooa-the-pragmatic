import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTrace } from "./storage";
import { runTrace } from "./execute";

const roots: string[] = [];

async function createRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "nooa-trace-exec-"));
	roots.push(root);
	return root;
}

describe("trace execute", () => {
	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("records a successful command with duration and touched files", async () => {
		const root = await createRoot();
		const result = await runTrace({
			action: "inspect",
			command: [
				"node",
				"-e",
				"require('node:fs').writeFileSync('touched.txt','ok'); console.log('done')",
			],
			cwd: root,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data.mode).toBe("inspect");
		expect(result.data.exitCode).toBe(0);
		expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
		expect(result.data.stdoutSummary).toContain("done");
		expect(result.data.filesTouched).toContain("touched.txt");

		const stored = await loadTrace(root, result.data.traceId);
		expect(stored?.traceId).toBe(result.data.traceId);
		expect(stored?.filesTouched).toContain("touched.txt");
	});

	test("records a failing command and preserves stderr summary", async () => {
		const root = await createRoot();
		const result = await runTrace({
			action: "inspect",
			command: ["node", "-e", "console.error('boom'); process.exit(2)"],
			cwd: root,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data.exitCode).toBe(2);
		expect(result.data.stderrSummary).toContain("boom");
		expect(result.data.stdoutSummary).toBe("");
		expect(await loadTrace(root, result.data.traceId)).not.toBeNull();
	});

	test("accepts general local commands beyond node bun and nooa", async () => {
		const root = await createRoot();
		const result = await runTrace({
			action: "inspect",
			command: ["sh", "-c", "echo shell-ok"],
			cwd: root,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.exitCode).toBe(0);
		expect(result.data.stdoutSummary).toContain("shell-ok");
	});

	test("detects edits to existing files as touched", async () => {
		const root = await createRoot();
		const target = join(root, "existing.txt");
		await writeFile(target, "before");

		const result = await runTrace({
			action: "inspect",
			command: [
				"node",
				"-e",
				"require('node:fs').appendFileSync('existing.txt','-after')",
			],
			cwd: root,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.filesTouched).toContain("existing.txt");
		expect(await readFile(target, 'utf8')).toBe("before-after");
	});

	test("rejects missing commands", async () => {
		const result = await runTrace({
			action: "inspect",
			command: [],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("trace.invalid_target");
		}
	});
});
