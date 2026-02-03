/**
 * Profile Loader Tests (TDD)
 * Test YAML profile loading with both Auditor-style and NOOA-style formats.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadProfile,
	normalizeToNooaFormat,
	validateProfile,
} from "./profiles";

describe("Profile Loader", () => {
	let tempDir: string;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "guardrail-test-"));
	});

	afterAll(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("loadProfile", () => {
		it("should load a valid NOOA-style profile", async () => {
			const profileYaml = `
refactor_name: test-profile
description: Test profile for unit tests
version: "1.0.0"
rules:
  - id: no-todos
    description: No TODO comments allowed
    severity: low
    match:
      anyOf:
        - type: literal
          value: "TODO"
`;
			const profilePath = join(tempDir, "nooa-style.yaml");
			await writeFile(profilePath, profileYaml);

			const profile = await loadProfile(profilePath);

			expect(profile.refactor_name).toBe("test-profile");
			expect(profile.rules).toHaveLength(1);
			expect(profile.rules[0].id).toBe("no-todos");
		});

		it("should throw on invalid YAML", async () => {
			const invalidYaml = `
refactor_name: missing-rules
description: This profile has no rules
`;
			const profilePath = join(tempDir, "invalid.yaml");
			await writeFile(profilePath, invalidYaml);

			await expect(loadProfile(profilePath)).rejects.toThrow();
		});

		it("should throw on non-existent file", async () => {
			await expect(loadProfile("/nonexistent/path.yaml")).rejects.toThrow();
		});
	});

	describe("validateProfile", () => {
		it("should return valid: true for valid profile", async () => {
			const validYaml = `
refactor_name: valid-profile
description: A valid profile
rules:
  - id: rule-1
    description: Rule one
    match: {}
`;
			const profilePath = join(tempDir, "validate-valid.yaml");
			await writeFile(profilePath, validYaml);

			const result = await validateProfile(profilePath);

			expect(result.valid).toBe(true);
			expect(result.errors).toBeUndefined();
		});

		it("should return valid: false with errors for invalid profile", async () => {
			const invalidYaml = `
description: Missing name
rules: []
`;
			const profilePath = join(tempDir, "validate-invalid.yaml");
			await writeFile(profilePath, invalidYaml);

			const result = await validateProfile(profilePath);

			expect(result.valid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors?.length).toBeGreaterThan(0);
		});
	});

	describe("normalizeToNooaFormat (Auditor compatibility)", () => {
		it("should normalize Auditor-style identifiers to NOOA patterns", () => {
			const auditorMatch = {
				identifiers: ["User", "Account"],
				expressions: ["jwt\\.sign"],
			};

			const normalized = normalizeToNooaFormat(auditorMatch);

			expect(normalized.anyOf).toBeDefined();
			expect(normalized.anyOf).toHaveLength(3);
			expect(normalized.anyOf?.[0]).toEqual({ type: "literal", value: "User" });
			expect(normalized.anyOf?.[1]).toEqual({
				type: "literal",
				value: "Account",
			});
			expect(normalized.anyOf?.[2]).toEqual({
				type: "regex",
				value: "jwt\\.sign",
			});
		});

		it("should pass through NOOA-style patterns unchanged", () => {
			const nooaMatch = {
				anyOf: [{ type: "literal" as const, value: "TODO" }],
			};

			const normalized = normalizeToNooaFormat(nooaMatch);

			expect(normalized).toEqual(nooaMatch);
		});

		it("should return empty spec for empty input", () => {
			const empty = {};

			const normalized = normalizeToNooaFormat(empty);

			expect(normalized.anyOf).toBeUndefined();
			expect(normalized.allOf).toBeUndefined();
		});
	});
});
