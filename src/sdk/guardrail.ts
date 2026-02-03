import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
	buildProfileFromSpec,
	getBuiltinProfilesDir,
	GuardrailEngine,
	loadBuiltinProfile,
	loadProfile,
	parseGuardrailSpec,
	validateProfile,
} from "../features/guardrail";
import type { Finding, GuardrailReport } from "../features/guardrail/contracts";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface GuardrailCheckInput {
	profile?: string;
	spec?: boolean;
	cwd?: string;
}

export interface GuardrailValidateInput {
	profile?: string;
}

export interface GuardrailAddInput {
	name?: string;
	cwd?: string;
}

export interface GuardrailRemoveInput {
	name?: string;
	force?: boolean;
	cwd?: string;
}

export interface GuardrailSpecInput {
	cwd?: string;
}

function specPathFromCwd(cwd?: string) {
	if (!cwd) return undefined;
	return join(cwd, ".nooa", "guardrails", "GUARDRAIL.md");
}

function buildReport(
	findings: Finding[],
	profilePath: string,
	executionMs: number,
	thresholds?: { critical: number; high: number; medium: number; low: number },
): GuardrailReport {
	const severityCounts = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0,
		info: 0,
	};

	for (const f of findings) {
		severityCounts[f.severity]++;
	}

	let status: "pass" | "warning" | "fail" = "pass";
	if (thresholds) {
		const hasBlocking =
			severityCounts.critical > thresholds.critical ||
			severityCounts.high > thresholds.high;
		const hasWarnings =
			severityCounts.medium > thresholds.medium ||
			severityCounts.low > thresholds.low;

		if (hasBlocking) status = "fail";
		else if (hasWarnings) status = "warning";
	} else {
		const hasBlocking = severityCounts.critical > 0 || severityCounts.high > 0;
		const hasWarnings = severityCounts.medium > 0 || severityCounts.low > 0;

		if (hasBlocking) status = "fail";
		else if (hasWarnings) status = "warning";
	}

	return {
		status,
		findings,
		summary: {
			filesScanned: new Set(findings.map((f) => f.file)).size,
			findingsTotal: findings.length,
			findingsBySeverity: severityCounts,
			deterministic: true,
			executionMs,
		},
		meta: {
			command: "guardrail check",
			profile: profilePath,
			traceId: "deterministic",
		},
	};
}

export async function check(
	input: GuardrailCheckInput,
): Promise<SdkResult<GuardrailReport>> {
	if (!input.profile && !input.spec) {
		return {
			ok: false,
			error: sdkError("invalid_input", "profile or spec required.", {
				fields: ["profile", "spec"],
			}),
		};
	}
	try {
		let profilePath = input.profile ?? "";
		let thresholds: { critical: number; high: number; medium: number; low: number } | undefined;
		let exclusions: string[] | undefined;

		if (input.spec) {
			const spec = await parseGuardrailSpec(specPathFromCwd(input.cwd));
			const profile = await buildProfileFromSpec(spec);
			const engine = new GuardrailEngine(input.cwd ?? process.cwd());
			const startTime = Date.now();
			const findings = await engine.evaluate(profile, { exclude: spec.exclusions });
			const executionMs = Date.now() - startTime;
			thresholds = spec.thresholds as { critical: number; high: number; medium: number; low: number };
			exclusions = spec.exclusions;
			const report = buildReport(findings, "GUARDRAIL.md (spec)", executionMs, thresholds);
			return { ok: true, data: report };
		}

		const builtinProfiles = ["zero-preguica", "security", "dangerous-patterns", "default"];
		if (profilePath && builtinProfiles.includes(profilePath)) {
			profilePath = join(getBuiltinProfilesDir(), `${profilePath}.yaml`);
		}

		const profile = await loadProfile(profilePath);
		const engine = new GuardrailEngine(input.cwd ?? process.cwd());
		const startTime = Date.now();
		const findings = await engine.evaluate(profile, { exclude: exclusions });
		const executionMs = Date.now() - startTime;
		const report = buildReport(findings, input.profile ?? profilePath, executionMs, thresholds);
		return { ok: true, data: report };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail check failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function validate(
	input: GuardrailValidateInput,
): Promise<SdkResult<{ valid: boolean; errors?: string[] }>> {
	if (!input.profile) {
		return {
			ok: false,
			error: sdkError("invalid_input", "profile is required.", {
				field: "profile",
			}),
		};
	}
	try {
		const result = await validateProfile(input.profile);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail validate failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function init(input: GuardrailSpecInput = {}): Promise<SdkResult<{ ok: boolean }>> {
	const guardrailsDir = join(input.cwd ?? process.cwd(), ".nooa", "guardrails");
	const profilesDir = join(guardrailsDir, "profiles");
	const templatesDir = join(guardrailsDir, "templates");
	try {
		await mkdir(profilesDir, { recursive: true });
		await mkdir(templatesDir, { recursive: true });

		const defaultProfile = join(profilesDir, "default.yaml");
		try {
			await access(defaultProfile);
		} catch {
			await writeFile(
				defaultProfile,
				`# NOOA Guardrail Profile - Default
refactor_name: default
description: Default guardrail profile for NOOA
version: "1.0.0"

rules:
  - id: no-todos
    description: No TODO comments in production code
    severity: low
    match:
      anyOf:
        - type: literal
          value: "TODO"
    scope:
      exclude:
        - "**/*.test.ts"
        - "**/*.spec.ts"

  - id: no-fixmes
    description: No FIXME comments in production code
    severity: medium
    match:
      anyOf:
        - type: literal
          value: "FIXME"
    scope:
      exclude:
        - "**/*.test.ts"
`,
			);
		}

		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail init failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function list(): Promise<SdkResult<string[]>> {
	try {
		const entries = await readdir(getBuiltinProfilesDir(), { withFileTypes: true });
		const names = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
			.map((entry) => entry.name.replace(/\.yaml$/, ""))
			.sort();
		return { ok: true, data: names };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail list failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function show(input: { name?: string }): Promise<SdkResult<string>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "profile name or path required.")
		};
	}
	try {
		let profilePath = input.name;
		if (!input.name.endsWith(".yaml")) {
			profilePath = join(getBuiltinProfilesDir(), `${input.name}.yaml`);
		}
		const profile = await loadProfile(profilePath);
		return { ok: true, data: stringifyYaml(profile) };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail show failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function add(
	input: GuardrailAddInput,
): Promise<SdkResult<{ path: string }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "profile name required.")
		};
	}
	const profilesDir = getBuiltinProfilesDir();
	const profilePath = join(profilesDir, `${input.name}.yaml`);

	try {
		await mkdir(profilesDir, { recursive: true });
		try {
			await access(profilePath);
			return { ok: false, error: sdkError("validation_error", "profile already exists.") };
		} catch {
			// continue
		}
		await writeFile(
			profilePath,
			`# NOOA Guardrail Profile
refactor_name: ${input.name}
description: ${input.name} profile
version: "1.0.0"

rules:
  - id: example-rule
    description: Example rule
    severity: low
    match:
      anyOf:
        - type: literal
          value: "TODO"
`,
		);
		return { ok: true, data: { path: profilePath } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail add failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function remove(
	input: GuardrailRemoveInput,
): Promise<SdkResult<{ removed: boolean }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "profile name required.")
		};
	}
	if (!input.force) {
		return {
			ok: false,
			error: sdkError("invalid_input", "force is required to remove.")
		};
	}
	const profilePath = join(getBuiltinProfilesDir(), `${input.name}.yaml`);
	try {
		await rm(profilePath);
		return { ok: true, data: { removed: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail remove failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const spec = {
	show: async (input: GuardrailSpecInput = {}) => {
		try {
			const specData = await parseGuardrailSpec(specPathFromCwd(input.cwd));
			return { ok: true, data: specData } as SdkResult<typeof specData>;
		} catch (error) {
			return {
				ok: false,
				error: sdkError("guardrail_error", "Spec show failed.", {
					message: error instanceof Error ? error.message : String(error),
				}),
			};
		}
	},
	init: async (input: GuardrailSpecInput = {}) => {
		const guardrailsDir = join(input.cwd ?? process.cwd(), ".nooa", "guardrails");
		try {
			await mkdir(guardrailsDir, { recursive: true });
			const specPath = join(guardrailsDir, "GUARDRAIL.md");
			try {
				await access(specPath);
			} catch {
				await writeFile(
					specPath,
					`# GUARDRAIL.md

## Enabled Profiles

- zero-preguica

## Thresholds

| Severity | Threshold |
|----------|-----------|
| critical | 0         |
| high     | 0         |
| medium   | 10        |
| low      | 50        |

## Exclusions

\`\`\`
**/node_modules/**
\`\`\`
`,
				);
			}
			return { ok: true, data: { ok: true } };
		} catch (error) {
			return {
				ok: false,
				error: sdkError("guardrail_error", "Spec init failed.", {
					message: error instanceof Error ? error.message : String(error),
				}),
			};
		}
	},
	validate: async (input: GuardrailSpecInput = {}) => {
		try {
			const specData = await parseGuardrailSpec(specPathFromCwd(input.cwd));
			const invalidProfiles: string[] = [];
			for (const profileName of specData.profiles) {
				try {
					await loadBuiltinProfile(profileName);
				} catch {
					invalidProfiles.push(profileName);
				}
			}
			if (invalidProfiles.length > 0) {
				return {
					ok: false,
					error: sdkError("validation_error", "Spec references missing profiles.", {
						profiles: invalidProfiles,
					}),
				};
			}
			return { ok: true, data: { ok: true } };
		} catch (error) {
			return {
				ok: false,
				error: sdkError("guardrail_error", "Spec validate failed.", {
					message: error instanceof Error ? error.message : String(error),
				}),
			};
		}
	},
};

export const guardrail = {
	check,
	validate,
	init,
	list,
	show,
	spec,
	add,
	remove,
};
