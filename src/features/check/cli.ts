import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { execa } from "execa";
import type { Command, CommandContext } from "../../core/command";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { loadProfile } from "../guardrail/profiles";
import { GuardrailEngine } from "../guardrail/engine";
import type { GuardrailReport } from "../guardrail/contracts";

export async function checkCli(args: string[]) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			staged: { type: "boolean" },
			json: { type: "boolean" },
			profile: { type: "string", short: "p" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
	});

	const checkHelp = `
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
`;

	if (values.help) {
		console.log(checkHelp);
		return;
	}

	// If --profile is specified, delegate to guardrail engine
	if (values.profile) {
		await runGuardrailCheck(values.profile, values.json);
		return;
	}

	// Original PolicyEngine logic
	const engine = new PolicyEngine();
	let filesToCheck: string[] = [];

	if (values.staged) {
		try {
			const { stdout } = await execa("git", [
				"diff",
				"--cached",
				"--name-only",
				"--diff-filter=ACMR",
			]);
			filesToCheck = stdout.split("\n").filter((f) => f.trim() !== "");
		} catch {
			console.error("❌ Not a git repository or git error.");
			process.exit(1);
		}
	} else {
		const target = positionals[0] || ".";
		filesToCheck = await growFileList(target);
	}

	const result = await engine.checkFiles(filesToCheck);

	if (values.json) {
		console.log(JSON.stringify(result, null, 2));
		if (!result.ok) process.exitCode = 2;
	} else {
		if (result.ok) {
			console.log("\n✅ Policy check passed. Code is NOOA-grade (anti-lazy).");
		} else {
			console.error(
				`\n❌ Policy violations found (${result.violations.length}):`,
			);
			for (const v of result.violations) {
				console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
				console.error(`  Reason: ${v.message}`);
			}
			process.exitCode = 2; // Policy violation exit code
		}
	}
}

async function runGuardrailCheck(profilePath: string, jsonOutput?: boolean) {
	try {
		const profile = await loadProfile(profilePath);
		const engine = new GuardrailEngine(process.cwd());
		const startTime = Date.now();
		const findings = await engine.evaluate(profile);
		const executionMs = Date.now() - startTime;

		const report = buildGuardrailReport(findings, profilePath, executionMs);

		if (jsonOutput) {
			console.log(JSON.stringify(report, null, 2));
		} else {
			printGuardrailReport(report);
		}

		// Exit codes: 0=pass, 2=blocking, 3=warning
		if (report.status === "fail") {
			process.exitCode = 2;
		} else if (report.status === "warning") {
			process.exitCode = 3;
		}
	} catch (error) {
		console.error(`Error: ${error}`);
		process.exitCode = 1;
	}
}

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

	// Simple recursive glob-like expansion (ignoring .git, node_modules)
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

const checkCommand: Command = {
	name: "check",
	description: "Audit code against project policies (Zero-Preguiça)",
	async execute({ rawArgs }: CommandContext) {
		const index = rawArgs.indexOf("check");
		await checkCli(rawArgs.slice(index + 1));
	},
};

export default checkCommand;
