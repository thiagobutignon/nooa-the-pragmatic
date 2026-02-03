import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PolicyEngine } from "./PolicyEngine";

describe("PolicyEngine", () => {
	const testDir = join(process.cwd(), "temp-policy-test");

	beforeEach(() => {
		try {
			mkdirSync(testDir);
		} catch {}
	});

	afterEach(() => {
		try {
			rmdirSync(testDir, { recursive: true });
		} catch {}
	});

	test("identifies forbidden markers", async () => {
		const filePath = join(testDir, "dirty.ts");
		writeFileSync(
			filePath,
			"// TODO: fix this\nconsole.log('test');\n// FIXME: urgent",
		);

		const engine = new PolicyEngine(testDir);
		const violations = await engine.checkFile(filePath);

		expect(violations.length).toBe(2);
		expect(violations[0].rule).toBe("no-todo");
		expect(violations[1].rule).toBe("no-fixme");
	});

	test("respects nooa-ignore comment", async () => {
		const filePath = join(testDir, "ignored.ts");
		writeFileSync(
			filePath,
			"// TODO: fix this nooa-ignore\nconsole.log('test');",
		);

		const engine = new PolicyEngine(testDir);
		const violations = await engine.checkFile(filePath);

		expect(violations.length).toBe(0);
	});

	test("respects .nooa-ignore file", async () => {
		const ignorePath = join(testDir, ".nooa-ignore");
		writeFileSync(ignorePath, "skip-me.ts\n# comment\n  \n");

		const filePath = join(testDir, "skip-me.ts");
		writeFileSync(filePath, "// TODO: fix this");

		const engine = new PolicyEngine(testDir);
		const violations = await engine.checkFile(filePath);

		expect(violations.length).toBe(0);
	});

	test("ignores non-source files and tests", async () => {
		const engine = new PolicyEngine(testDir);

		expect(await engine.checkFile("test.md")).toEqual([]);
		expect(await engine.checkFile("file.tpl")).toEqual([]);
		expect(await engine.checkFile("src/file.test.ts")).toEqual([]);
		expect(await engine.checkFile("src/file.spec.ts")).toEqual([]);
		expect(await engine.checkFile("src/mock/file.ts")).toEqual([]);
		expect(await engine.checkFile("src/file.mock.ts")).toEqual([]);
	});

	test("checkFiles aggregates results", async () => {
		const f1 = join(testDir, "f1.ts");
		const f2 = join(testDir, "f2.ts");
		writeFileSync(f1, "// TODO: fix this");
		writeFileSync(f2, "clean");

		const engine = new PolicyEngine(testDir);
		const result = await engine.checkFiles([f1, f2]);

		expect(result.ok).toBe(false);
		expect(result.violations.length).toBe(1);
	});

	test("handles file read errors gracefully", async () => {
		const engine = new PolicyEngine(testDir);
		const violations = await engine.checkFile("non-existent.ts");
		expect(violations).toEqual([]);
	});
});
