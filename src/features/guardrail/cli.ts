/**
 * Guardrail CLI
 * Command-line interface for guardrail profile checking.
 * Subcommands: check, validate, init
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import type { Finding, GuardrailReport } from "./contracts";
import { ExitCode } from "./contracts";
import { GuardrailEngine } from "./engine";
import { loadProfile, validateProfile } from "./profiles";
import { buildProfileFromSpec, parseGuardrailSpec } from "./spec";

const HELP_TEXT = `
Usage: nooa guardrail <subcommand> [options]

Subcommands:
  check      Run guardrail checks against code
  validate   Validate a YAML profile schema
  init       Initialize .nooa/guardrails directory

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
		let profile;
		let profileName: string;

		if (values.spec) {
			// Load from GUARDRAIL.md spec
			const spec = await parseGuardrailSpec();
			profile = await buildProfileFromSpec(spec);
			profileName = "GUARDRAIL.md (spec)";
		} else {
			profile = await loadProfile(values.profile!);
			profileName = values.profile!;
		}

		const engine = new GuardrailEngine(process.cwd());
		const startTime = Date.now();
		const findings = await engine.evaluate(profile);
		const executionMs = Date.now() - startTime;

		const report = buildReport(findings, profileName, executionMs);

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

function buildReport(
	findings: Finding[],
	profilePath: string,
	executionMs: number,
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

	const hasBlocking = severityCounts.critical > 0 || severityCounts.high > 0;
	const hasWarnings = severityCounts.medium > 0 || severityCounts.low > 0;

	let status: "pass" | "warning" | "fail" = "pass";
	if (hasBlocking) status = "fail";
	else if (hasWarnings) status = "warning";

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
