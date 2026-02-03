/**
 * Guardrail Profile Loader
 * Loads and validates YAML profiles with Auditor + NOOA format compatibility.
 * Clean-room implementation (AGPL-safe).
 */
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import {
	type AuditorPatternSpec,
	type Pattern,
	type PatternSpec,
	type RefactorProfile,
	RefactorProfileSchema,
} from "./schemas";

/**
 * Load and validate a YAML profile from disk.
 * @param path - Absolute or relative path to the YAML file
 * @returns Parsed and validated RefactorProfile
 * @throws Error if file doesn't exist or validation fails
 */
export async function loadProfile(path: string): Promise<RefactorProfile> {
	const content = await readFile(path, "utf-8");
	const raw = parseYaml(content);

	// Normalize any Auditor-style patterns before validation
	if (raw?.rules && Array.isArray(raw.rules)) {
		for (const rule of raw.rules) {
			if (rule.match) {
				rule.match = normalizeToNooaFormat(rule.match);
			}
			if (rule.expect) {
				rule.expect = normalizeToNooaFormat(rule.expect);
			}
		}
	}

	return RefactorProfileSchema.parse(raw);
}

/**
 * Validate a profile without loading it into memory.
 * @param path - Path to the YAML file
 * @returns Validation result with errors if invalid
 */
export async function validateProfile(path: string): Promise<{
	valid: boolean;
	errors?: string[];
}> {
	try {
		await loadProfile(path);
		return { valid: true };
	} catch (error) {
		if (error instanceof Error) {
			return { valid: false, errors: [error.message] };
		}
		return { valid: false, errors: ["Unknown validation error"] };
	}
}

/**
 * Normalize Auditor-style pattern spec to NOOA v2 format.
 * Supports backward compatibility with copied YAML templates.
 *
 * Auditor format:
 *   match:
 *     identifiers: ["User", "Account"]  # literal matches
 *     expressions: ["jwt\\.sign"]        # regex matches
 *
 * NOOA v2 format:
 *   match:
 *     anyOf:
 *       - { type: "literal", value: "User" }
 *       - { type: "regex", value: "jwt\\.sign" }
 */
export function normalizeToNooaFormat(
	input: PatternSpec | AuditorPatternSpec | Record<string, unknown>,
): PatternSpec {
	// If already in NOOA format (has anyOf or allOf), return as-is
	if ("anyOf" in input || "allOf" in input) {
		return input as PatternSpec;
	}

	// Convert Auditor format to NOOA format
	const patterns: Pattern[] = [];

	// Auditor identifiers -> literal patterns
	if ("identifiers" in input && Array.isArray(input.identifiers)) {
		for (const id of input.identifiers) {
			patterns.push({ type: "literal", value: String(id) });
		}
	}

	// Auditor expressions -> regex patterns
	if ("expressions" in input && Array.isArray(input.expressions)) {
		for (const expr of input.expressions) {
			patterns.push({ type: "regex", value: String(expr) });
		}
	}

	// Auditor sql_tables -> literal patterns
	if ("sql_tables" in input && Array.isArray(input.sql_tables)) {
		for (const table of input.sql_tables) {
			patterns.push({ type: "literal", value: String(table) });
		}
	}

	// Auditor api_routes -> regex patterns (routes often have params)
	if ("api_routes" in input && Array.isArray(input.api_routes)) {
		for (const route of input.api_routes) {
			patterns.push({ type: "regex", value: String(route) });
		}
	}

	// Return empty spec if no patterns found
	if (patterns.length === 0) {
		return {};
	}

	// Auditor uses OR logic by default
	return { anyOf: patterns };
}
