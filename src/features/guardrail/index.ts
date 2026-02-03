/**
 * Guardrail Feature Exports
 * Public API for the guardrail system.
 */

export type { Finding, GuardrailReport } from "./contracts";
// Contracts
export { Confidence, ExitCode, Severity } from "./contracts";
// Engine
export { GuardrailEngine } from "./engine";
// Profiles
export {
	loadProfile,
	normalizeToNooaFormat,
	validateProfile,
} from "./profiles";
export type {
	Pattern,
	PatternSpec,
	RefactorProfile,
	RefactorRule,
} from "./schemas";
// Schemas
export {
	PatternSchema,
	PatternSpecSchema,
	RefactorProfileSchema,
	RefactorRuleSchema,
} from "./schemas";

// Built-in Profiles
export {
	getBuiltinProfilesDir,
	listBuiltinProfiles,
	loadBuiltinProfile,
} from "./builtin";
export type { BuiltinProfileName } from "./builtin";

// Spec Parser
export { parseGuardrailSpec, buildProfileFromSpec } from "./spec";
export type { GuardrailSpec } from "./spec";
