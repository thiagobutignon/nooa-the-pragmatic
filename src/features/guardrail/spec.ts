/**
 * Spec Parser
 * Parses GUARDRAIL.md to extract enabled profiles and custom rules.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { type BuiltinProfileName, loadBuiltinProfile } from "./builtin";
import type { RefactorProfile, RefactorRule } from "./schemas";
import { RefactorRuleSchema } from "./schemas";

export interface GuardrailSpec {
	profiles: BuiltinProfileName[];
	customRules: RefactorRule[];
	thresholds: Record<string, number>;
	exclusions: string[];
}

/**
 * Parse GUARDRAIL.md to extract spec configuration.
 */
export async function parseGuardrailSpec(
	specPath?: string,
): Promise<GuardrailSpec> {
	const path =
		specPath ?? join(process.cwd(), ".nooa", "guardrails", "GUARDRAIL.md");

	if (!existsSync(path)) {
		return {
			profiles: ["zero-preguica"],
			customRules: [],
			thresholds: { critical: 0, high: 0, medium: 10, low: 50 },
			exclusions: [],
		};
	}

	const content = await readFile(path, "utf-8");
	return extractSpec(content);
}

function extractSpec(content: string): GuardrailSpec {
	const profiles = extractProfiles(content);
	const customRules = extractCustomRules(content);
	const thresholds = extractThresholds(content);
	const exclusions = extractExclusions(content);

	return { profiles, customRules, thresholds, exclusions };
}

function extractProfiles(content: string): BuiltinProfileName[] {
	const profilesSection = content.match(
		/## Enabled Profiles[\s\S]*?(?=##|$)/,
	)?.[0];
	if (!profilesSection) return ["zero-preguica"];

	const profiles: BuiltinProfileName[] = [];
	const validProfiles: BuiltinProfileName[] = [
		"zero-preguica",
		"security",
		"dangerous-patterns",
		"default",
	];

	for (const line of profilesSection.split("\n")) {
		const match = line.match(/^-\s+(\S+)/);
		if (match) {
			const name = match[1] as BuiltinProfileName;
			if (validProfiles.includes(name)) {
				profiles.push(name);
			}
		}
	}

	return profiles.length > 0 ? profiles : ["zero-preguica"];
}

function extractCustomRules(content: string): RefactorRule[] {
	const rulesSection = content.match(
		/## Custom Rules[\s\S]*?```yaml([\s\S]*?)```/,
	);
	if (!rulesSection) return [];

	try {
		const yaml = rulesSection[1];
		const parsed = parseYaml(yaml);

		if (!parsed?.rules || !Array.isArray(parsed.rules)) return [];

		return parsed.rules
			.map((rule: unknown) => {
				const result = RefactorRuleSchema.safeParse(rule);
				return result.success ? result.data : null;
			})
			.filter(Boolean);
	} catch {
		return [];
	}
}

function extractThresholds(content: string): Record<string, number> {
	const defaults = { critical: 0, high: 0, medium: 10, low: 50 };
	const thresholdsSection = content.match(/## Thresholds[\s\S]*?(?=##|$)/)?.[0];
	if (!thresholdsSection) return defaults;

	const thresholds = { ...defaults };
	const rows = thresholdsSection.match(/\|\s*(\w+)\s*\|\s*(\d+)\s*\|/g);

	if (rows) {
		for (const row of rows) {
			const match = row.match(/\|\s*(\w+)\s*\|\s*(\d+)\s*\|/);
			if (match) {
				const [, severity, threshold] = match;
				if (severity && threshold && severity in thresholds) {
					thresholds[severity as keyof typeof thresholds] = parseInt(
						threshold,
						10,
					);
				}
			}
		}
	}

	return thresholds;
}

function extractExclusions(content: string): string[] {
	const exclusionsSection = content.match(
		/## Exclusions[\s\S]*?```([\s\S]*?)```/,
	);
	if (!exclusionsSection) return [];

	return exclusionsSection[1]
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));
}

/**
 * Build a merged profile from spec configuration.
 */
export async function buildProfileFromSpec(
	spec: GuardrailSpec,
): Promise<RefactorProfile> {
	const rules: RefactorRule[] = [];

	// Load enabled built-in profiles
	for (const profileName of spec.profiles) {
		try {
			const profile = await loadBuiltinProfile(profileName);
			rules.push(...profile.rules);
		} catch {
			// Profile not found, skip
		}
	}

	// Add custom rules
	rules.push(...spec.customRules);

	return {
		refactor_name: "spec-combined",
		description: "Combined profile from GUARDRAIL.md spec",
		version: "1.0.0",
		rules,
	};
}
