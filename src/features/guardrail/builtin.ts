/**
 * Built-in Profile Utilities
 * Helper functions to load built-in guardrail profiles.
 */
import { join } from "node:path";
import { loadProfile } from "./profiles";
import type { RefactorProfile } from "./schemas";

/**
 * Available built-in profile names.
 */
export type BuiltinProfileName =
	| "zero-preguica"
	| "security"
	| "dangerous-patterns"
	| "semantic-sanitization"
	| "default";

/**
 * Get the path to the built-in profiles directory.
 */
export function getBuiltinProfilesDir(): string {
	return join(process.cwd(), ".nooa", "guardrails", "profiles");
}

/**
 * Load a built-in profile by name.
 * @param name - The name of the built-in profile
 * @returns The loaded profile
 */
export async function loadBuiltinProfile(
	name: BuiltinProfileName,
): Promise<RefactorProfile> {
	const profilesDir = getBuiltinProfilesDir();
	const profilePath = join(profilesDir, `${name}.yaml`);
	return loadProfile(profilePath);
}

/**
 * List all available built-in profile names.
 */
export function listBuiltinProfiles(): BuiltinProfileName[] {
	return [
		"zero-preguica",
		"security",
		"dangerous-patterns",
		"semantic-sanitization",
		"default",
	];
}
