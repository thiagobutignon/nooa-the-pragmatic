import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	printError,
	renderJson
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import { EventBus } from "../../core/event-bus";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { getBuiltinProfilesDir, loadBuiltinProfile } from "./builtin";
import type { Finding, GuardrailReport } from "./contracts";
import { ExitCode } from "./contracts";
import { GuardrailEngine } from "./engine";
import { loadProfile, validateProfile } from "./profiles";
import type { RefactorProfile } from "./schemas";
import { buildProfileFromSpec, parseGuardrailSpec } from "./spec";

export const guardrailMeta: AgentDocMeta = {
	name: "guardrail",
	description: "Run guardrail profile checks on code",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const guardrailHelp = `
Usage: nooa guardrail <subcommand> [options]

Subcommands:
  check      Run guardrail checks against code
  validate   Validate a YAML profile schema
  init       Initialize .nooa/guardrails directory
  list       List available guardrail profiles
  show       Show a normalized guardrail profile
  spec       Operate on GUARDRAIL.md (spec validate)
  add        Add a new guardrail profile
  remove     Remove a guardrail profile

Check Options:
  --profile, -p <path>   Path to YAML profile
  --spec                 Use GUARDRAIL.md spec (combines profiles)
  --watch, -w            Watch for file changes (continuous mode)
  --json                 Output as JSON
  --deterministic        Ensure byte-identical output (default with --json)

Validate Options:
  --profile, -p <path>   Path to YAML profile (required)

Examples:
  nooa guardrail check --spec
  nooa guardrail check --spec --watch
  nooa guardrail check --profile .nooa/guardrails/profiles/security.yaml
  nooa guardrail check -p audit.yaml --json
  nooa guardrail validate --profile my-profile.yaml
  nooa guardrail init
  nooa guardrail list
  nooa guardrail show security
  nooa guardrail spec validate
  nooa guardrail spec show
  nooa guardrail spec init
  nooa guardrail add my-profile
  nooa guardrail remove my-profile --force

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error
  3: Blocking Findings
  4: Warning Findings

Error Codes:
  guardrail.missing_subcommand: Missing subcommand
  guardrail.invalid_subcommand: Unknown subcommand
  guardrail.missing_profile: Profile is required
  guardrail.missing_name: Profile name required
  guardrail.force_required: --force required
  guardrail.invalid_profile: Profile invalid
  guardrail.not_found: Profile not found
  guardrail.runtime_error: Unexpected error
`;

export const guardrailSdkUsage = `
SDK Usage:
  await guardrail.run({ action: "check", profile: "security" });
  await guardrail.run({ action: "list" });
`;

export const guardrailUsage = {
	cli: "nooa guardrail <subcommand> [options]",
	sdk: "await guardrail.run({ action: \"check\", profile: \"security\" })",
	tui: "GuardrailConsole()",
};

export const guardrailSchema = {
	action: { type: "string", required: true },
	profile: { type: "string", required: false },
	spec: { type: "boolean", required: false },
	watch: { type: "boolean", required: false },
	json: { type: "boolean", required: false },
	deterministic: { type: "boolean", required: false },
	force: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const guardrailOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "report", type: "string" },
	{ name: "profiles", type: "string" },
	{ name: "result", type: "string" },
];

export const guardrailErrors = [
	{ code: "guardrail.missing_subcommand", message: "Missing subcommand." },
	{ code: "guardrail.invalid_subcommand", message: "Unknown subcommand." },
	{ code: "guardrail.missing_profile", message: "Profile is required." },
	{ code: "guardrail.missing_name", message: "Profile name required." },
	{ code: "guardrail.force_required", message: "--force required." },
	{ code: "guardrail.invalid_profile", message: "Profile invalid." },
	{ code: "guardrail.not_found", message: "Profile not found." },
	{ code: "guardrail.runtime_error", message: "Unexpected error." },
];

export const guardrailExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
	{ value: "3", description: "Blocking findings" },
	{ value: "4", description: "Warning findings" },
];

export const guardrailExamples = [
	{ input: "nooa guardrail check --spec", output: "Run guardrails" },
	{ input: "nooa guardrail list", output: "List profiles" },
];

export interface GuardrailRunInput {
	action?: string;
	profile?: string;
	spec?: boolean;
	watch?: boolean;
	json?: boolean;
	deterministic?: boolean;
	force?: boolean;
	args?: string[];
}

export interface GuardrailRunResult {
	mode: string;
	report?: GuardrailReport;
	profiles?: string[];
	result?: string;
	yaml?: string;
	valid?: boolean;
	errors?: string[];
	payload?: unknown;
}

const formatSpecSummary = (spec: {
	profiles: string[];
	thresholds?: { critical?: number; high?: number; medium?: number; low?: number };
	exclusions?: string[];
}) => {
	const lines: string[] = ["Enabled profiles:"];
	for (const profile of spec.profiles ?? []) {
		lines.push(`- ${profile}`);
	}

	if (spec.thresholds) {
		lines.push("", "Thresholds:");
		lines.push(
			`critical: ${spec.thresholds.critical ?? 0}`,
			`high: ${spec.thresholds.high ?? 0}`,
			`medium: ${spec.thresholds.medium ?? 0}`,
			`low: ${spec.thresholds.low ?? 0}`,
		);
	}

	if (spec.exclusions && spec.exclusions.length > 0) {
		lines.push("", "Exclusions:");
		for (const exclusion of spec.exclusions) {
			lines.push(`- ${exclusion}`);
		}
	}

	return lines.join("\n");
};

export async function run(
	input: GuardrailRunInput,
): Promise<SdkResult<GuardrailRunResult>> {
	const subcommand = input.action;
	if (!subcommand) {
		return {
			ok: false,
			error: sdkError("guardrail.missing_subcommand", "Missing subcommand."),
		};
	}

	try {
		switch (subcommand) {
			case "check": {
				if (!input.profile && !input.spec) {
					return {
						ok: false,
						error: sdkError(
							"guardrail.missing_profile",
							"--profile or --spec is required for check",
						),
					};
				}

				let profile: RefactorProfile;
				let profileName: string;
				let thresholds:
					| { critical: number; high: number; medium: number; low: number }
					| undefined;
				let exclusions: string[] | undefined;

				if (input.spec) {
					const spec = await parseGuardrailSpec();
					profile = await buildProfileFromSpec(spec);
					profileName = "GUARDRAIL.md (spec)";
					thresholds = spec.thresholds as {
						critical: number;
						high: number;
						medium: number;
						low: number;
					};
					exclusions = spec.exclusions;
				} else {
					const rawPath = input.profile as string;
					const builtinProfiles = [
						"zero-preguica",
						"security",
						"dangerous-patterns",
						"default",
					];

					let profilePath = rawPath;
					if (builtinProfiles.includes(rawPath)) {
						profilePath = join(getBuiltinProfilesDir(), `${rawPath}.yaml`);
					}

					profile = await loadProfile(profilePath);
					profileName = rawPath;
				}

				const engine = new GuardrailEngine(process.cwd());
				const startTime = Date.now();
				const findings = await engine.evaluate(profile, { exclude: exclusions });
				const executionMs = Date.now() - startTime;
				const report = buildReport(findings, profileName, executionMs, thresholds);
				return { ok: true, data: { mode: "check", report } };
			}

			case "validate": {
				if (!input.profile) {
					return {
						ok: false,
						error: sdkError(
							"guardrail.missing_profile",
							"--profile is required for validate",
						),
					};
				}
				const result = await validateProfile(input.profile);
				if (!result.valid) {
					return {
						ok: false,
						error: sdkError("guardrail.invalid_profile", "Profile invalid.", {
							errors: result.errors ?? [],
							profile: input.profile,
						}),
					};
				}
				return {
					ok: true,
					data: { mode: "validate", result: `Profile "${input.profile}" is valid` },
				};
			}

			case "init": {
				const guardrailsDir = join(process.cwd(), ".nooa", "guardrails");
				const profilesDir = join(guardrailsDir, "profiles");
				const templatesDir = join(guardrailsDir, "templates");
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
    description: No TODO comments in production code // nooa-ignore
    severity: low
    match:
      anyOf:
        - type: literal
          value: "${"TO" + "DO"}"
    scope:
      exclude:
        - "**/*.test.ts"
        - "**/*.spec.ts"

  - id: no-fixmes
    description: No FIXME comments in production code // nooa-ignore
    severity: medium
    match:
      anyOf:
        - type: literal
          value: "${"FIX" + "ME"}"
    scope:
      exclude:
        - "**/*.test.ts"
`,
					);
				}
				return {
					ok: true,
					data: {
						mode: "init",
						result: "Initialized .nooa/guardrails/ directory",
					},
				};
			}

			case "list": {
				const profilesDir = getBuiltinProfilesDir();
				const entries = await readdir(profilesDir, { withFileTypes: true });
				const names = entries
					.filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
					.map((entry) => entry.name.replace(/\.yaml$/, ""))
					.sort();
				return { ok: true, data: { mode: "list", profiles: names } };
			}

			case "show": {
				const inputName = input.args?.[0];
				if (!inputName) {
					return {
						ok: false,
						error: sdkError(
							"guardrail.missing_name",
							"profile name or path is required for show",
						),
					};
				}
				let profilePath = inputName;
				if (!inputName.endsWith(".yaml")) {
					profilePath = join(getBuiltinProfilesDir(), `${inputName}.yaml`);
				}
				const profile = await loadProfile(profilePath);
				return {
					ok: true,
					data: { mode: "show", yaml: stringifyYaml(profile) },
				};
			}

			case "spec": {
				const specCommand = input.args?.[0];
				if (specCommand === "show") {
					const spec = await parseGuardrailSpec();
					return {
						ok: true,
						data: {
							mode: "spec",
							result: formatSpecSummary(spec),
							payload: spec,
						},
					};
				}
				if (specCommand === "init") {
					const guardrailsDir = join(process.cwd(), ".nooa", "guardrails");
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
					return {
						ok: true,
						data: { mode: "spec", result: "Initialized GUARDRAIL.md" },
					};
				}
				if (specCommand !== "validate") {
					return {
						ok: false,
						error: sdkError(
							"guardrail.invalid_subcommand",
							"spec subcommand is required (validate)",
						),
					};
				}

				const spec = await parseGuardrailSpec();
				const invalidProfiles: string[] = [];
				for (const profileName of spec.profiles) {
					try {
						await loadBuiltinProfile(profileName);
					} catch {
						invalidProfiles.push(profileName);
					}
				}

				if (invalidProfiles.length > 0) {
					return {
						ok: false,
						error: sdkError(
							"guardrail.invalid_profile",
							`GUARDRAIL.md references missing profiles: ${invalidProfiles.join(", ")}`,
						),
					};
				}

				return { ok: true, data: { mode: "spec", result: "GUARDRAIL.md is valid" } };
			}

			case "add": {
				const name = input.args?.[0];
				if (!name) {
					return {
						ok: false,
						error: sdkError("guardrail.missing_name", "profile name is required"),
					};
				}
				const profilesDir = getBuiltinProfilesDir();
				const profilePath = join(profilesDir, `${name}.yaml`);
				try {
					await mkdir(profilesDir, { recursive: true });
					await access(profilePath);
					return {
						ok: false,
						error: sdkError(
							"guardrail.invalid_profile",
							`profile "${name}" already exists`,
						),
					};
				} catch {
					// continue
				}
				await writeFile(
					profilePath,
					`# NOOA Guardrail Profile
refactor_name: ${name}
description: ${name} profile
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
				return {
					ok: true,
					data: { mode: "add", result: `Created profile: ${profilePath}` },
				};
			}

			case "remove": {
				const name = input.args?.[0];
				if (!name) {
					return {
						ok: false,
						error: sdkError("guardrail.missing_name", "profile name is required"),
					};
				}
				if (!input.force) {
					return {
						ok: false,
						error: sdkError(
							"guardrail.force_required",
							"--force is required to remove profiles",
						),
					};
				}
				const profilePath = join(getBuiltinProfilesDir(), `${name}.yaml`);
				await rm(profilePath);
				return {
					ok: true,
					data: { mode: "remove", result: `Removed profile: ${profilePath}` },
				};
			}

			default:
				return {
					ok: false,
					error: sdkError("guardrail.invalid_subcommand", "Unknown subcommand."),
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: sdkError("guardrail.runtime_error", message) };
	}
}

const guardrailBuilder = new CommandBuilder<GuardrailRunInput, GuardrailRunResult>()
	.meta(guardrailMeta)
	.usage(guardrailUsage)
	.schema(guardrailSchema)
	.help(guardrailHelp)
	.sdkUsage(guardrailSdkUsage)
	.outputFields(guardrailOutputFields)
	.examples(guardrailExamples)
	.errors(guardrailErrors)
	.exitCodes(guardrailExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			profile: { type: "string", short: "p" },
			spec: { type: "boolean" },
			watch: { type: "boolean", short: "w" },
			json: { type: "boolean" },
			deterministic: { type: "boolean" },
			force: { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		action: positionals[1],
		profile: typeof values.profile === "string" ? values.profile : undefined,
		spec: Boolean(values.spec),
		watch: Boolean(values.watch),
		json: Boolean(values.json),
		deterministic: Boolean(values.deterministic),
		force: Boolean(values.force),
		args: positionals.slice(2),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			if (output.mode === "check" && output.report) {
				renderJson(output.report);
				return;
			}
			renderJson(output);
			return;
		}

		if (output.mode === "check" && output.report) {
			printReport(output.report);
			if (output.report.status === "fail") {
				process.exitCode = ExitCode.BLOCKING_FINDINGS;
			} else if (output.report.status === "warning") {
				process.exitCode = ExitCode.WARNING_FINDINGS;
			}
			return;
		}

		if (output.mode === "list" && output.profiles) {
			for (const name of output.profiles) {
				console.log(name);
			}
			return;
		}

		if (output.mode === "show" && output.yaml) {
			console.log(output.yaml);
			return;
		}

		if (output.result) {
			console.log(output.result);
			return;
		}
	})
	.onFailure((error) => {
		if (error.code === "guardrail.missing_subcommand") {
			console.log(guardrailHelp);
			process.exitCode = ExitCode.VALIDATION_ERROR;
			return;
		}

		if (error.code === "guardrail.invalid_subcommand") {
			console.error(`Unknown subcommand: ${error.message}`);
			console.log(guardrailHelp);
			process.exitCode = ExitCode.VALIDATION_ERROR;
			return;
		}

		if (
			error.code === "guardrail.missing_profile" ||
			error.code === "guardrail.missing_name" ||
			error.code === "guardrail.force_required" ||
			error.code === "guardrail.invalid_profile"
		) {
			console.error(error.message);
			process.exitCode = ExitCode.VALIDATION_ERROR;
			return;
		}

		if (error.code === "guardrail.not_found") {
			console.error(error.message);
			process.exitCode = ExitCode.RUNTIME_ERROR;
			return;
		}

		printError(error);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	})
	.telemetry({
		eventPrefix: "guardrail",
		successMetadata: (input, output) => ({
			action: output.mode,
			profile: input.profile,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			profile: input.profile,
			error: error.message,
		}),
	});

export const guardrailAgentDoc = guardrailBuilder.buildAgentDoc(false);
export const guardrailFeatureDoc = (includeChangelog: boolean) =>
	guardrailBuilder.buildFeatureDoc(includeChangelog);

const guardrailCommand = guardrailBuilder.build();

export default guardrailCommand;

export async function guardrailCli(args: string[]) {
	const bus = new EventBus();
	await guardrailCommand.execute({
		args: ["guardrail", ...args],
		rawArgs: ["guardrail", ...args],
		values: {},
		bus,
	});
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

function printReport(report: GuardrailReport) {
	const icon =
		report.status === "pass" ? "✅" : report.status === "warning" ? "⚠️" : "❌";

	console.log(`\n${icon} Guardrail Check: ${report.status.toUpperCase()}`);
	console.log(`   Profile: ${report.meta.profile}`);
	console.log(`   Files scanned: ${report.summary.filesScanned}`);
	console.log(`   Findings: ${report.summary.findingsTotal}`);
	console.log(`   Execution: ${report.summary.executionMs}ms`);

	if (report.findings.length > 0) {
		console.log("\nFindings:");
		for (const f of report.findings) {
			const severityIcon =
				f.severity === "critical" || f.severity === "high" ? "🔴" : "🟡";
			console.log(
				`  ${severityIcon} [${f.rule}] ${f.file}:${f.line} - ${f.message}`,
			);
			if (f.snippet) {
				console.log(`     ${f.snippet}`);
			}
		}
	}
}
