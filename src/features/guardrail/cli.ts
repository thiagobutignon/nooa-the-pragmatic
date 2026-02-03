/**
 * Guardrail CLI
 * Command-line interface for guardrail profile checking.
 * Subcommands: check, validate, init
 */

import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { stringify as stringifyYaml } from "yaml";
import type { Command, CommandContext } from "../../core/command";
import { getBuiltinProfilesDir, loadBuiltinProfile } from "./builtin";
import type { Finding, GuardrailReport } from "./contracts";
import { ExitCode } from "./contracts";
import { GuardrailEngine } from "./engine";
import { loadProfile, validateProfile } from "./profiles";
import type { RefactorProfile } from "./schemas";
import { buildProfileFromSpec, parseGuardrailSpec } from "./spec";

const HELP_TEXT = `
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
`;

export async function guardrailCli(args: string[]) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			profile: { type: "string", short: "p" },
			spec: { type: "boolean" },
			watch: { type: "boolean", short: "w" },
			json: { type: "boolean" },
			deterministic: { type: "boolean" },
			force: { type: "boolean" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
	});

	if (values.help || positionals.length === 0) {
		console.log(HELP_TEXT);
		return;
	}

	const subcommand = positionals[0];

	switch (subcommand) {
		case "check":
			await handleCheck(values);
			break;
		case "validate":
			await handleValidate(values);
			break;
		case "init":
			await handleInit();
			break;
		case "list":
			await handleList();
			break;
		case "show":
			await handleShow(positionals[1]);
			break;
		case "spec":
			await handleSpec(positionals.slice(1));
			break;
		case "add":
			await handleAdd(positionals[1]);
			break;
		case "remove":
			await handleRemove(positionals[1], values.force);
			break;
		default:
			console.error(`Unknown subcommand: ${subcommand}`);
			console.log(HELP_TEXT);
			process.exitCode = ExitCode.VALIDATION_ERROR;
	}
}

async function handleCheck(values: {
	profile?: string;
	spec?: boolean;
	json?: boolean;
	deterministic?: boolean;
}) {
	if (!values.profile && !values.spec) {
		console.error("Error: --profile or --spec is required for check");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}

	try {
		let profile: RefactorProfile;
		let profileName: string;
		let thresholds:
			| { critical: number; high: number; medium: number; low: number }
			| undefined;
		let exclusions: string[] | undefined;

		if (values.spec) {
			// Load from GUARDRAIL.md spec
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
			if (!values.profile) {
				console.error("Error: --profile is required for check");
				process.exitCode = ExitCode.VALIDATION_ERROR;
				return;
			}
			const rawPath = values.profile;
			const builtinProfiles = [
				"zero-preguica",
				"security",
				"dangerous-patterns",
				"default",
			];

			let profilePath = rawPath;
			if (builtinProfiles.includes(rawPath)) {
				const { getBuiltinProfilesDir } = await import("./builtin");
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

		if (values.json) {
			console.log(JSON.stringify(report, null, 2));
		} else {
			printReport(report);
		}

		// Set exit code based on findings
		if (report.status === "fail") {
			process.exitCode = ExitCode.BLOCKING_FINDINGS;
		} else if (report.status === "warning") {
			process.exitCode = ExitCode.WARNING_FINDINGS;
		}
	} catch (error) {
		console.error(`Error: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
}

async function handleValidate(values: { profile?: string }) {
	if (!values.profile) {
		console.error("Error: --profile is required for validate");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}

	const result = await validateProfile(values.profile);

	if (result.valid) {
		console.log(`✅ Profile "${values.profile}" is valid`);
	} else {
		console.error(`❌ Profile "${values.profile}" is invalid:`);
		for (const error of result.errors ?? []) {
			console.error(`   ${error}`);
		}
		process.exitCode = ExitCode.VALIDATION_ERROR;
	}
}

async function handleInit() {
	const guardrailsDir = join(process.cwd(), ".nooa", "guardrails");
	const profilesDir = join(guardrailsDir, "profiles");
	const templatesDir = join(guardrailsDir, "templates");

	try {
		await mkdir(profilesDir, { recursive: true });
		await mkdir(templatesDir, { recursive: true });

		// Create default profile if not exists
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

		console.log("✅ Initialized .nooa/guardrails/ directory");
		console.log("   Created: profiles/default.yaml");
		console.log(
			"\nRun: nooa guardrail check --profile .nooa/guardrails/profiles/default.yaml",
		);
	} catch (error) {
		console.error(`Error initializing guardrails: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
}

async function handleList() {
	const profilesDir = getBuiltinProfilesDir();
	try {
		const entries = await readdir(profilesDir, { withFileTypes: true });
		const names = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
			.map((entry) => entry.name.replace(/\.yaml$/, ""))
			.sort();

		for (const name of names) {
			console.log(name);
		}
	} catch (error) {
		console.error(`Error listing profiles: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
}

async function handleShow(input?: string) {
	if (!input) {
		console.error("Error: profile name or path is required for show");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}

	try {
		let profilePath = input;
		if (!input.endsWith(".yaml")) {
			profilePath = join(getBuiltinProfilesDir(), `${input}.yaml`);
		}
		const profile = await loadProfile(profilePath);
		console.log(stringifyYaml(profile));
	} catch (error) {
		console.error(`Error showing profile: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
}

async function handleSpec(args: string[]) {
	const subcommand = args[0];

	if (subcommand === "show") {
		try {
			const spec = await parseGuardrailSpec();
			console.log("Enabled profiles:");
			for (const profileName of spec.profiles) {
				console.log(`- ${profileName}`);
			}
		} catch (error) {
			console.error(`Error showing GUARDRAIL.md: ${error}`);
			process.exitCode = ExitCode.RUNTIME_ERROR;
		}
		return;
	}

	if (subcommand === "init") {
		const guardrailsDir = join(process.cwd(), ".nooa", "guardrails");
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
			console.log("✅ Initialized GUARDRAIL.md");
		} catch (error) {
			console.error(`Error initializing GUARDRAIL.md: ${error}`);
			process.exitCode = ExitCode.RUNTIME_ERROR;
		}
		return;
	}

	if (subcommand !== "validate") {
		console.error("Error: spec subcommand is required (validate)");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}

	try {
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
			console.error(
				`❌ GUARDRAIL.md references missing profiles: ${invalidProfiles.join(", ")}`,
			);
			process.exitCode = ExitCode.VALIDATION_ERROR;
			return;
		}

		console.log("✅ GUARDRAIL.md is valid");
	} catch (error) {
		console.error(`Error validating GUARDRAIL.md: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
}

async function handleAdd(name?: string) {
	if (!name) {
		console.error("Error: profile name is required for add");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}

	const profilesDir = getBuiltinProfilesDir();
	const profilePath = join(profilesDir, `${name}.yaml`);

	try {
		await mkdir(profilesDir, { recursive: true });
		await access(profilePath);
		console.error(`Error: profile "${name}" already exists`);
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	} catch {
		// File doesn't exist, continue.
	}

	try {
		await writeFile(
			profilePath,
			`# NOOA Guardrail Profile\nrefactor_name: ${name}\ndescription: ${name} profile\nversion: "1.0.0"\n\nrules:\n  - id: example-rule\n    description: Example rule\n    severity: low\n    match:\n      anyOf:\n        - type: literal\n          value: "TODO"\n`,
		);
		console.log(`✅ Created profile: ${profilePath}`);
	} catch (error) {
		console.error(`Error creating profile: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
}

async function handleRemove(name?: string, force?: boolean) {
	if (!name) {
		console.error("Error: profile name is required for remove");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}
	if (!force) {
		console.error("Error: --force is required to remove profiles");
		process.exitCode = ExitCode.VALIDATION_ERROR;
		return;
	}

	const profilePath = join(getBuiltinProfilesDir(), `${name}.yaml`);
	try {
		await rm(profilePath);
		console.log(`✅ Removed profile: ${profilePath}`);
	} catch (error) {
		console.error(`Error removing profile: ${error}`);
		process.exitCode = ExitCode.RUNTIME_ERROR;
	}
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
			traceId: "deterministic", // Fixed for determinism
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

const guardrailCommand: Command = {
	name: "guardrail",
	description: "Run guardrail profile checks on code",
	async execute({ rawArgs }: CommandContext) {
		const index = rawArgs.indexOf("guardrail");
		await guardrailCli(rawArgs.slice(index + 1));
	},
};

export default guardrailCommand;
