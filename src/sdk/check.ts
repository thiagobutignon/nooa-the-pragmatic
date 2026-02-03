import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { PolicyEngine } from "../core/policy/PolicyEngine";
import type { GuardrailReport } from "../features/guardrail/contracts";
import { GuardrailEngine } from "../features/guardrail/engine";
import { loadProfile } from "../features/guardrail/profiles";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface CheckRunInput {
	paths?: string[];
	path?: string;
	staged?: boolean;
	profile?: string;
}

export type CheckRunResult =
	| {
			type: "policy";
			result: {
				ok: boolean;
				violations: Array<{
					rule: string;
					file: string;
					line: number;
					content: string;
					message: string;
				}>;
			};
	  }
	| {
			type: "guardrail";
			report: GuardrailReport;
	  };

export async function run(
	input: CheckRunInput,
): Promise<SdkResult<CheckRunResult>> {
	if (input.profile) {
		return await runGuardrailCheck(input.profile);
	}

	try {
		let filesToCheck: string[] = [];
		if (input.staged) {
			const { stdout } = await execa("git", [
				"diff",
				"--cached",
				"--name-only",
				"--diff-filter=ACMR",
			]);
			filesToCheck = stdout.split("\n").filter((f) => f.trim() !== "");
		} else if (input.paths && input.paths.length > 0) {
			filesToCheck = await expandPaths(input.paths);
		} else {
			const target = input.path ?? ".";
			filesToCheck = await growFileList(target);
		}

		const engine = new PolicyEngine();
		const result = await engine.checkFiles(filesToCheck);
		return { ok: true, data: { type: "policy", result } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("check_error", "Policy check failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

async function runGuardrailCheck(
	profilePath: string,
): Promise<SdkResult<CheckRunResult>> {
	try {
		const profile = await loadProfile(profilePath);
		const engine = new GuardrailEngine(process.cwd());
		const startTime = Date.now();
		const findings = await engine.evaluate(profile);
		const executionMs = Date.now() - startTime;

		const report = buildGuardrailReport(findings, profilePath, executionMs);
		return { ok: true, data: { type: "guardrail", report } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("guardrail_error", "Guardrail check failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
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

async function expandPaths(paths: string[]): Promise<string[]> {
	const expanded: string[] = [];
	for (const path of paths) {
		const stat = await lstat(path);
		if (stat.isFile()) {
			expanded.push(path);
		} else if (stat.isDirectory()) {
			expanded.push(...(await growFileList(path)));
		}
	}
	return expanded;
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

export const check = {
	run,
};
