/**
 * Spec Parser Tests
 * Test GUARDRAIL.md parsing functionality.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProfileFromSpec, parseGuardrailSpec } from "./spec";

describe("Spec Parser", () => {
	describe("parseGuardrailSpec", () => {
		let tempDir: string;

		beforeAll(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "spec-parser-test-"));
			await mkdir(join(tempDir, ".nooa/guardrails"), { recursive: true });
		});

		afterAll(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should return defaults when no spec file exists", async () => {
			const spec = await parseGuardrailSpec(join(tempDir, "nonexistent.md"));
			expect(spec.profiles).toContain("zero-preguica");
			expect(spec.customRules).toHaveLength(0);
			expect(spec.thresholds.critical).toBe(0);
		});

		it("should parse profiles from spec", async () => {
			const specContent = `
# GUARDRAIL.md

## Enabled Profiles

- zero-preguica
- security

## Thresholds

| Severity | Threshold |
|----------|-----------|
| critical | 0         |
`;
			await writeFile(join(tempDir, "spec.md"), specContent);

			const spec = await parseGuardrailSpec(join(tempDir, "spec.md"));
			expect(spec.profiles).toContain("zero-preguica");
			expect(spec.profiles).toContain("security");
		});

		it("should parse thresholds from spec", async () => {
			const specContent = `
## Thresholds

| Severity | Threshold |
|----------|-----------|
| critical | 0         |
| high     | 5         |
| medium   | 20        |
| low      | 100       |
`;
			await writeFile(join(tempDir, "thresholds.md"), specContent);

			const spec = await parseGuardrailSpec(join(tempDir, "thresholds.md"));
			expect(spec.thresholds.critical).toBe(0);
			expect(spec.thresholds.high).toBe(5);
			expect(spec.thresholds.medium).toBe(20);
			expect(spec.thresholds.low).toBe(100);
		});

		it("should parse custom rules from spec", async () => {
			const specContent = `
## Custom Rules

\`\`\`yaml
rules:
  - id: custom-rule
    description: Custom test rule
    severity: high
    match:
      anyOf:
        - type: literal
          value: "DEPRECATED"
\`\`\`
`;
			await writeFile(join(tempDir, "custom.md"), specContent);

			const spec = await parseGuardrailSpec(join(tempDir, "custom.md"));
			expect(spec.customRules.length).toBe(1);
			expect(spec.customRules[0].id).toBe("custom-rule");
		});

		it("should parse exclusions from spec", async () => {
			const specContent = `
## Exclusions

\`\`\`
**/*.test.ts
**/node_modules/**
\`\`\`
`;
			await writeFile(join(tempDir, "exclusions.md"), specContent);

			const spec = await parseGuardrailSpec(join(tempDir, "exclusions.md"));
			expect(spec.exclusions).toContain("**/*.test.ts");
			expect(spec.exclusions).toContain("**/node_modules/**");
		});

		it("parses custom rules without require()", async () => {
			const specContent = `
## Custom Rules

\`\`\`yaml
rules:
  - id: custom-rule
    description: Custom test rule
    severity: high
    match:
      anyOf:
        - type: literal
          value: "DEPRECATED"
\`\`\`
`;
			await writeFile(join(tempDir, "custom-esm.md"), specContent);

			const originalRequire = (globalThis as { require?: unknown }).require;
			(globalThis as { require?: unknown }).require = undefined;
			try {
				const spec = await parseGuardrailSpec(join(tempDir, "custom-esm.md"));
				expect(spec.customRules.length).toBe(1);
			} finally {
				(globalThis as { require?: unknown }).require = originalRequire;
			}
		});

		it("does not rely on require() for yaml parsing", async () => {
			const content = await Bun.file(join(import.meta.dir, "spec.ts")).text();
			expect(content.includes('require("yaml")')).toBe(false);
			expect(content.includes("require('yaml')")).toBe(false);
		});
	});

	describe("buildProfileFromSpec", () => {
		it("should build combined profile from spec", async () => {
			const spec = {
				profiles: ["zero-preguica" as const],
				customRules: [
					{
						id: "custom",
						description: "Custom rule",
						severity: "medium" as const,
						match: { anyOf: [{ type: "literal" as const, value: "TEST" }] },
					},
				],
				thresholds: { critical: 0, high: 0, medium: 10, low: 50 },
				exclusions: [],
			};

			const profile = await buildProfileFromSpec(spec);
			expect(profile.refactor_name).toBe("spec-combined");
			expect(profile.rules.length).toBeGreaterThanOrEqual(1);
		});
	});
});
