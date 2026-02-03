/**
 * Guardrail Schemas Tests (TDD - RED phase)
 * Test Zod schemas for YAML profile validation.
 */
import { describe, expect, it } from "bun:test";
import {
	type Pattern,
	PatternSchema,
	PatternSpecSchema,
	type RefactorProfile,
	RefactorProfileSchema,
	type RefactorRule,
	RefactorRuleSchema,
} from "./schemas";

describe("Guardrail Schemas", () => {
	describe("PatternSchema", () => {
		it("should validate a literal pattern", () => {
			const pattern: Pattern = {
				type: "literal",
				value: "TODO",
			};

			const result = PatternSchema.parse(pattern);
			expect(result.type).toBe("literal");
			expect(result.value).toBe("TODO");
		});

		it("should validate a regex pattern", () => {
			const pattern: Pattern = {
				type: "regex",
				value: "jwt\\.sign",
				flags: "i",
			};

			const result = PatternSchema.parse(pattern);
			expect(result.type).toBe("regex");
			expect(result.flags).toBe("i");
		});

		it("should default type to literal", () => {
			const result = PatternSchema.parse({ value: "FIXME" });
			expect(result.type).toBe("literal");
		});

		it("should reject invalid type", () => {
			expect(() =>
				PatternSchema.parse({ type: "invalid", value: "test" }),
			).toThrow();
		});
	});

	describe("PatternSpecSchema", () => {
		it("should validate anyOf patterns", () => {
			const spec = {
				anyOf: [
					{ type: "literal", value: "TODO" },
					{ type: "regex", value: "FIXME" },
				],
			};

			const result = PatternSpecSchema.parse(spec);
			expect(result.anyOf).toHaveLength(2);
		});

		it("should validate allOf patterns", () => {
			const spec = {
				allOf: [{ type: "literal", value: "import" }],
			};

			const result = PatternSpecSchema.parse(spec);
			expect(result.allOf).toHaveLength(1);
		});

		it("should accept empty spec", () => {
			const result = PatternSpecSchema.parse({});
			expect(result.anyOf).toBeUndefined();
			expect(result.allOf).toBeUndefined();
		});
	});

	describe("RefactorRuleSchema", () => {
		it("should validate a complete rule", () => {
			const rule: RefactorRule = {
				id: "no-hardcoded-jwt",
				description: "JWT secrets must use environment variables",
				severity: "critical",
				category: "security",
				match: {
					anyOf: [{ type: "regex", value: "jwt\\.sign\\(['\"]" }],
				},
				scope: {
					include: ["**/*.ts"],
					exclude: ["**/*.test.ts"],
				},
				guidance: "Use process.env.JWT_SECRET instead",
			};

			const result = RefactorRuleSchema.parse(rule);
			expect(result.id).toBe("no-hardcoded-jwt");
			expect(result.severity).toBe("critical");
		});

		it("should reject rule without id", () => {
			expect(() =>
				RefactorRuleSchema.parse({
					description: "Missing id",
					match: {},
				}),
			).toThrow();
		});

		it("should default severity to medium", () => {
			const result = RefactorRuleSchema.parse({
				id: "test-rule",
				description: "Test",
				match: {},
			});
			expect(result.severity).toBe("medium");
		});
	});

	describe("RefactorProfileSchema", () => {
		it("should validate a complete profile", () => {
			const profile: RefactorProfile = {
				refactor_name: "security-audit",
				description: "Security checks for production code",
				version: "1.0.0",
				rules: [
					{
						id: "no-secrets",
						description: "No hardcoded secrets",
						match: { anyOf: [{ type: "literal", value: "API_KEY=" }] },
					},
				],
				metadata: { author: "security-team" },
			};

			const result = RefactorProfileSchema.parse(profile);
			expect(result.refactor_name).toBe("security-audit");
			expect(result.rules).toHaveLength(1);
		});

		it("should reject profile without name", () => {
			expect(() =>
				RefactorProfileSchema.parse({
					description: "Missing name",
					rules: [],
				}),
			).toThrow();
		});

		it("should reject profile without rules", () => {
			expect(() =>
				RefactorProfileSchema.parse({
					refactor_name: "test",
					description: "Missing rules",
				}),
			).toThrow();
		});
	});
});
