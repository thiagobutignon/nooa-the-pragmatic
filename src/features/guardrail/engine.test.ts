/**
 * Guardrail Engine Tests (TDD)
 * Test deterministic pattern matching and finding generation.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "./contracts";
import { GuardrailEngine } from "./engine";
import type { RefactorProfile } from "./schemas";

describe("GuardrailEngine", () => {
	let tempDir: string;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "guardrail-engine-test-"));

		// Initialize git repo for deterministic file list
		execSync("git init", { cwd: tempDir, stdio: "ignore" });

		// Create test files
		await writeFile(
			join(tempDir, "file1.ts"),
			`// TODO: fix this\nconst x = 1;`,
		);
		await writeFile(
			join(tempDir, "file2.ts"),
			`// FIXME: urgent\nconst y = 2;`,
		);
		await writeFile(
			join(tempDir, "file3.test.ts"),
			`// TODO: test this\nconst z = 3;`,
		);
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src/api.ts"),
			`const secret = "API_KEY=abc123";`,
		);

		// Git add all files
		execSync("git add .", { cwd: tempDir, stdio: "ignore" });
	});

	afterAll(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("evaluate", () => {
		it("should find TODO patterns in files", async () => {
			const profile: RefactorProfile = {
				refactor_name: "no-todos",
				description: "No TODO comments",
				rules: [
					{
						id: "no-todos",
						description: "TODO comments not allowed",
						severity: "low",
						match: {
							anyOf: [{ type: "literal", value: "TODO" }],
						},
					},
				],
			};

			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			expect(findings.length).toBeGreaterThan(0);
			expect(findings.every((f: Finding) => f.rule === "no-todos")).toBe(true);
		});

		it("should respect scope.exclude patterns", async () => {
			const profile: RefactorProfile = {
				refactor_name: "no-todos-exclude-tests",
				description: "No TODO except in tests",
				rules: [
					{
						id: "no-todos",
						description: "TODO comments not allowed",
						severity: "low",
						match: {
							anyOf: [{ type: "literal", value: "TODO" }],
						},
						scope: {
							exclude: ["**/*.test.ts"],
						},
					},
				],
			};

			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			// Should not find TODO in file3.test.ts
			expect(findings.every((f: Finding) => !f.file.includes(".test.ts"))).toBe(
				true,
			);
		});

		it("should return findings with correct structure", async () => {
			const profile: RefactorProfile = {
				refactor_name: "test-structure",
				description: "Test finding structure",
				version: "1.0.0",
				rules: [
					{
						id: "no-fixme",
						description: "FIXME not allowed",
						severity: "medium",
						category: "quality",
						match: {
							anyOf: [{ type: "literal", value: "FIXME" }],
						},
					},
				],
			};

			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			expect(findings.length).toBeGreaterThan(0);
			const finding = findings[0];
			expect(finding.rule).toBe("no-fixme");
			expect(finding.severity).toBe("medium");
			expect(finding.category).toBe("quality");
			expect(finding.file).toBeDefined();
			expect(finding.line).toBeGreaterThan(0);
		});
	});

	describe("determinism", () => {
		it("should produce identical findings on repeated runs", async () => {
			const profile: RefactorProfile = {
				refactor_name: "determinism-test",
				description: "Test determinism",
				rules: [
					{
						id: "no-todos",
						description: "TODO not allowed",
						severity: "low",
						match: {
							anyOf: [{ type: "literal", value: "TODO" }],
						},
					},
				],
			};

			const engine = new GuardrailEngine(tempDir);

			const run1 = await engine.evaluate(profile);
			const run2 = await engine.evaluate(profile);
			const run3 = await engine.evaluate(profile);

			// Same count
			expect(run1.length).toBe(run2.length);
			expect(run2.length).toBe(run3.length);

			// Same order and content (excluding timestamps)
			for (let i = 0; i < run1.length; i++) {
				expect(run1[i].rule).toBe(run2[i].rule);
				expect(run1[i].file).toBe(run2[i].file);
				expect(run1[i].line).toBe(run2[i].line);
			}
		});

		it("should return findings sorted by rule, file, line", async () => {
			const profile: RefactorProfile = {
				refactor_name: "sorting-test",
				description: "Test sorting",
				rules: [
					{
						id: "aaa-rule",
						description: "First rule",
						severity: "low",
						match: { anyOf: [{ type: "literal", value: "TODO" }] },
					},
					{
						id: "zzz-rule",
						description: "Last rule",
						severity: "low",
						match: { anyOf: [{ type: "literal", value: "TODO" }] },
					},
				],
			};

			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			// Check sorting by rule, then file, then line
			for (let i = 1; i < findings.length; i++) {
				const prev = findings[i - 1];
				const curr = findings[i];

				const comparison =
					prev.rule.localeCompare(curr.rule) ||
					prev.file.localeCompare(curr.file) ||
					prev.line - curr.line;

				expect(comparison).toBeLessThanOrEqual(0);
			}
		});
	});
});
