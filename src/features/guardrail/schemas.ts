/**
 * Guardrail Schemas
 * Zod schemas for validating YAML profiles.
 * Supports BOTH Auditor-style and NOOA-style formats.
 */
import { z } from "zod";

/**
 * Pattern definition for matching code.
 * NOOA v2 format: explicit type + value
 */
export const PatternSchema = z.object({
	type: z.enum(["literal", "regex"]).default("literal"),
	value: z.string(),
	flags: z.string().optional(),
});
export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Pattern specification with logical operators.
 * anyOf = match ANY pattern (OR logic)
 * allOf = match ALL patterns (AND logic)
 */
export const PatternSpecSchema = z.object({
	anyOf: z.array(PatternSchema).optional(),
	allOf: z.array(PatternSchema).optional(),
});
export type PatternSpec = z.infer<typeof PatternSpecSchema>;

/**
 * Auditor-style pattern specification.
 * Used for backward compatibility with copied YAML templates.
 * Will be normalized to PatternSpec internally.
 */
export const AuditorPatternSpecSchema = z.object({
	identifiers: z.array(z.string()).optional(),
	expressions: z.array(z.string()).optional(),
	sql_tables: z.array(z.string()).optional(),
	api_routes: z.array(z.string()).optional(),
});
export type AuditorPatternSpec = z.infer<typeof AuditorPatternSpecSchema>;

/**
 * Scope definition for limiting where rules apply.
 */
export const ScopeSchema = z.object({
	include: z.array(z.string()).optional(),
	exclude: z.array(z.string()).optional(),
});
export type Scope = z.infer<typeof ScopeSchema>;

/**
 * Single refactor rule definition.
 * Validates both Auditor-style and NOOA-style rules.
 */
export const RefactorRuleSchema = z.object({
	/** Unique rule identifier */
	id: z.string(),
	/** Human-readable description */
	description: z.string(),
	/** Severity level */
	severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
	/** Category for grouping rules */
	category: z.string().optional(),
	/** Patterns to match (NOOA v2 format) */
	match: PatternSpecSchema,
	/** Expected patterns (for migration rules) */
	expect: PatternSpecSchema.optional(),
	/** File scope restrictions */
	scope: ScopeSchema.optional(),
	/** Guidance for fixing issues */
	guidance: z.string().optional(),
});
export type RefactorRule = z.infer<typeof RefactorRuleSchema>;

/**
 * Auditor-style refactor rule.
 * Used for compatibility with copied YAML templates.
 */
export const AuditorRefactorRuleSchema = z.object({
	id: z.string(),
	description: z.string(),
	severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
	category: z.string().optional(),
	match: AuditorPatternSpecSchema,
	expect: AuditorPatternSpecSchema.optional(),
	scope: ScopeSchema.optional(),
	guidance: z.string().optional(),
});
export type AuditorRefactorRule = z.infer<typeof AuditorRefactorRuleSchema>;

/**
 * Complete refactor profile.
 * Contains multiple rules for a specific refactoring or audit scenario.
 */
export const RefactorProfileSchema = z.object({
	/** Profile name (e.g., "jwt-migration", "security-audit") */
	refactor_name: z.string(),
	/** Description of what this profile checks */
	description: z.string(),
	/** Version for change tracking */
	version: z.string().optional(),
	/** List of rules to apply */
	rules: z.array(RefactorRuleSchema),
	/** Additional metadata */
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RefactorProfile = z.infer<typeof RefactorProfileSchema>;

/**
 * Auditor-style refactor profile.
 * Used for compatibility with copied YAML templates.
 */
export const AuditorRefactorProfileSchema = z.object({
	refactor_name: z.string().optional(),
	context_name: z.string().optional(), // Auditor uses this sometimes
	description: z.string(),
	version: z.string().optional(),
	rules: z.array(AuditorRefactorRuleSchema),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AuditorRefactorProfile = z.infer<
	typeof AuditorRefactorProfileSchema
>;
