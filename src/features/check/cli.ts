import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import type { GuardrailReport } from "../guardrail/contracts";
import { GuardrailEngine } from "../guardrail/engine";
import { loadProfile } from "../guardrail/profiles";

export const checkMeta: AgentDocMeta = {
	name: "check",
	description: "Audit code against project policies (Zero-Preguiça)",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const checkHelp = `
Usage: nooa check [path] [flags]

Audit code against project policies (Zero-Preguiça) or YAML guardrail profiles.

Flags:
  --staged           Audit only staged files in git.
  --json             Output result as structured JSON.
  -p, --profile      Path to YAML guardrail profile (uses guardrail engine).
  -h, --help         Show help message.

Examples:
  nooa check
  nooa check src --json
  nooa check --staged
  nooa check --profile .nooa/guardrails/profiles/security.yaml

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error / Policy Violations
  3: Guardrail Warnings

Error Codes:
  check.git_error: Git error when reading staged files
  check.policy_violation: Policy violations found
  check.guardrail_failed: Guardrail failed
  check.guardrail_warning: Guardrail warnings
  check.runtime_error: Unexpected error
`;

export const checkSdkUsage = `
SDK Usage:
  const result = await check.run({ path: ".", staged: false });
  if (result.ok) console.log(result.data.result.ok);
`;

export const checkUsage = {
	cli: "nooa check [path] [flags]",
	sdk: "await check.run({ path: \".\" })",
	tui: "CheckConsole()",
};

export const checkSchema = {
	path: { type: "string", required: false },
	staged: { type: "boolean", required: false },
	profile: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const checkOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "result", type: "string" },
	{ name: "report", type: "string" },
];

export const checkErrors = [
	{ code: "check.git_error", message: "Git error when reading staged files." },
	{ code: "check.policy_violation", message: "Policy violations found." },
	{ code: "check.guardrail_failed", message: "Guardrail failed." },
	{ code: "check.guardrail_warning", message: "Guardrail warnings." },
	{ code: "check.runtime_error", message: "Unexpected error." },
];

export const checkExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Policy violation / validation error" },
	{ value: "3", description: "Guardrail warning" },
];

export const checkExamples = [
	{ input: "nooa check", output: "Policy check" },
	{ input: "nooa check src --json", output: "JSON policy report" },
	{
		input: "nooa check --profile .nooa/guardrails/profiles/security.yaml",
		output: "Guardrail report",
	},
];

export interface CheckRunInput {
	path?: string;
	staged?: boolean;
	profile?: string;
	json?: boolean;
}

export interface CheckRunResult {
	mode: "policy" | "guardrail";
	result?: Awaited<ReturnType<PolicyEngine["checkFiles"]>>;
	report?: GuardrailReport;
}

async function runGuardrailCheck(
	profilePath: string,
): Promise<GuardrailReport> {
	const profile = await loadProfile(profilePath);
	const engine = new GuardrailEngine(process.cwd());
	const startTime = Date.now();
	const findings = await engine.evaluate(profile);
	const executionMs = Date.now() - startTime;

	return buildGuardrailReport(findings, profilePath, executionMs);
}

export async function run(
	input: CheckRunInput,
): Promise<SdkResult<CheckRunResult>> {
	try {
		if (input.profile) {
			const report = await runGuardrailCheck(input.profile);
			if (report.status === "fail") {
				return {
					ok: false,
					error: sdkError("check.guardrail_failed", "Guardrail failed.", {
						report,
					}),
				};
			}
			if (report.status === "warning") {
				return {
					ok: false,
					error: sdkError("check.guardrail_warning", "Guardrail warnings.", {
						report,
					}),
				};
			}
			return { ok: true, data: { mode: "guardrail", report } };
		}

		const engine = new PolicyEngine();
		let filesToCheck: string[] = [];

		if (input.staged) {
			try {
				const { stdout } = await execa("git", [
					"diff",
					"--cached",
					"--name-only",
					"--diff-filter=ACMR",
				]);
				filesToCheck = stdout.split("\n").filter((f) => f.trim() !== "");
			} catch (error) {
				return {
					ok: false,
					error: sdkError(
						"check.git_error",
						"Not a git repository or git error.",
					),
				};
			}
		} else {
			const target = input.path || ".";
			filesToCheck = await growFileList(target);
		}

		const result = await engine.checkFiles(filesToCheck);
		if (!result.ok) {
			return {
				ok: false,
				error: sdkError("check.policy_violation", "Policy violations found.", {
					result,
				}),
			};
		}

		return { ok: true, data: { mode: "policy", result } };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("check.runtime_error", message),
		};
	}
}

const checkBuilder = new CommandBuilder<CheckRunInput, CheckRunResult>()
	.meta(checkMeta)
	.usage(checkUsage)
	.schema(checkSchema)
	.help(checkHelp)
	.sdkUsage(checkSdkUsage)
	.outputFields(checkOutputFields)
	.examples(checkExamples)
	.errors(checkErrors)
	.exitCodes(checkExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			staged: { type: "boolean" },
			profile: { type: "string", short: "p" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		path: positionals[1],
		staged: Boolean(values.staged),
		profile: typeof values.profile === "string" ? values.profile : undefined,
		json: Boolean(values.json),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output.mode === "guardrail" ? output.report : output.result);
			return;
		}

		if (output.mode === "guardrail" && output.report) {
			printGuardrailReport(output.report);
			return;
		}

		if (output.result?.ok) {
			console.log("\n✅ Policy check passed. Code is NOOA-grade (anti-lazy).");
		}
	})
	.onFailure((error) => {
		if (error.code === "check.policy_violation") {
			const result = error.details?.result as
				| { violations: { rule: string; file: string; line: number; content: string; message: string }[] }
				| undefined;
			if (result) {
				console.error(
					`\n❌ Policy violations found (${result.violations.length}):`,
				);
				for (const v of result.violations) {
					console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
					console.error(`  Reason: ${v.message}`);
				}
			}
			process.exitCode = 2;
			return;
		}

		if (error.code === "check.guardrail_failed") {
			const report = error.details?.report as GuardrailReport | undefined;
			if (report) printGuardrailReport(report);
			process.exitCode = 2;
			return;
		}

		if (error.code === "check.guardrail_warning") {
			const report = error.details?.report as GuardrailReport | undefined;
			if (report) printGuardrailReport(report);
			process.exitCode = 3;
			return;
		}

		handleCommandError(error, ["check.policy_violation", "check.git_error"]);
	})
	.telemetry({
		eventPrefix: "check",
		successMetadata: (input, output) => ({
			mode: output.mode,
			path: input.path,
			staged: Boolean(input.staged),
		}),
		failureMetadata: (input, error) => ({
			path: input.path,
			staged: Boolean(input.staged),
			error: error.message,
		}),
	});

export const checkAgentDoc = checkBuilder.buildAgentDoc(false);
export const checkFeatureDoc = (includeChangelog: boolean) =>
	checkBuilder.buildFeatureDoc(includeChangelog);

const checkCommand = checkBuilder.build();

function buildGuardrailReport(
	findings: Array<{
		rule: string;
		severity: string;
		file: string;
		line: number;
		message: string;
		category?: string;
		confidence?: string;
		snippet?: string;
		column?: number;
	}>,
	profilePath: string,
	executionMs: number,
): GuardrailReport {
	const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
	for (const f of findings) {
		const sev = f.severity as keyof typeof severityCounts;
		if (sev in severityCounts) severityCounts[sev]++;
	}

	const hasBlocking = severityCounts.critical > 0 || severityCounts.high > 0;
	const hasWarnings = severityCounts.medium > 0 || severityCounts.low > 0;

	return {
		status: hasBlocking ? "fail" : hasWarnings ? "warning" : "pass",
		findings: findings.map((f) => ({
			...f,
			severity: f.severity as "critical" | "high" | "medium" | "low" | "info",
			confidence: (f.confidence ?? "high") as "high" | "medium" | "low",
			category: f.category ?? "guardrail",
		})),
		summary: {
			filesScanned: new Set(findings.map((f) => f.file)).size,
			findingsTotal: findings.length,
			findingsBySeverity: severityCounts,
			deterministic: true,
			executionMs,
		},
		meta: {
			command: "check --profile",
			profile: profilePath,
			traceId: "deterministic",
		},
	};
}

function printGuardrailReport(report: GuardrailReport) {
	const icon =
		report.status === "pass" ? "✅" : report.status === "warning" ? "⚠️" : "❌";

	console.log(`\n${icon} Guardrail Check: ${report.status.toUpperCase()}`);
	console.log(`   Profile: ${report.meta.profile}`);
	console.log(`   Findings: ${report.summary.findingsTotal}`);

	if (report.findings.length > 0) {
		for (const f of report.findings) {
			console.log(`  [${f.rule}] ${f.file}:${f.line} - ${f.message}`);
		}
	}
}

async function growFileList(path: string): Promise<string[]> {
	const stat = await lstat(path);
	if (stat.isFile()) return [path];

	const files: string[] = [];
	const entries = await readdir(path, { withFileTypes: true });

	for (const entry of entries) {
		const full = join(path, entry.name);
		if (entry.name === ".git" || entry.name === "node_modules") continue;
		if (entry.isDirectory()) {
			files.push(...(await growFileList(full)));
		} else {
			files.push(full);
		}
	}
	return files;
}

export default checkCommand;
