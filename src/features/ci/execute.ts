import { execa } from "execa";
import { createTraceId } from "../../core/logger";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { telemetry } from "../../core/telemetry";

export interface CiOptions {
	json?: boolean;
}

export interface CiResult {
	ok: boolean;
	traceId: string;
	test: { passed: boolean; exitCode: number; output?: string };
	lint: { passed: boolean; exitCode: number };
	check: { passed: boolean; violations: number };
	duration_ms: number;
}

export async function executeCi(
	_options: CiOptions,
	bus?: any,
): Promise<CiResult> {
	const traceId = createTraceId();
	const startTime = Date.now();

	// Recursion prevention (for tests)
	if (process.env.NOOA_SKIP_CI_RECURSION) {
		return {
			ok: true,
			traceId,
			test: { passed: true, exitCode: 0 },
			lint: { passed: true, exitCode: 0 },
			check: { passed: true, violations: 0 },
			duration_ms: 0,
		};
	}

	// 1. Run Tests
	let testPassed = true;
	let testResult = { exitCode: 0, stdout: "Skipped via NOOA_SKIP_TEST" } as any;

	if (!process.env.NOOA_SKIP_TEST) {
		testResult = await execa("bun", ["test"], {
			reject: false,
			cwd: process.cwd(),
		});
		testPassed = testResult.exitCode === 0;
	}

	// 2. Run Lint (biome check)
	const lintResult = await execa("bun", ["run", "check"], {
		reject: false,
		cwd: process.cwd(),
	});
	const lintPassed = lintResult.exitCode === 0;

	// 3. Run Policy Check - OTIMIZADO
	const engine = new PolicyEngine(process.cwd());

	// Opção: Apenas arquivos modificados (staged + modified)
	const { stdout: diffFiles } = await execa(
		"git",
		["diff", "--name-only", "HEAD"],
		{
			cwd: process.cwd(),
			reject: false,
		},
	);
	const { stdout: untrackedFiles } = await execa(
		"git",
		["ls-files", "--others", "--exclude-standard"],
		{
			cwd: process.cwd(),
			reject: false,
		},
	);

	const allChangedFiles = new Set([
		...diffFiles.split("\n"),
		...untrackedFiles.split("\n"),
	]);

	const files = Array.from(allChangedFiles).filter(
		(f) => f.endsWith(".ts") && !f.includes("node_modules"),
	);

	const checkResult =
		files.length > 0
			? await engine.checkFiles(files)
			: { ok: true, violations: [] };

	const duration_ms = Date.now() - startTime;
	const ok = testPassed && lintPassed && checkResult.ok;

	// Telemetry
	telemetry.track(
		{
			event: ok ? "ci.success" : "ci.failure",
			level: ok ? "info" : "warn",
			success: ok,
			duration_ms,
			trace_id: traceId,
			metadata: {
				test_passed: testPassed,
				lint_passed: lintPassed,
				policy_violations: checkResult.violations.length,
			},
		},
		bus,
	);

	return {
		ok,
		traceId,
		test: {
			passed: testPassed,
			exitCode: testResult.exitCode ?? 1,
			output: testResult.stdout,
		},
		lint: { passed: lintPassed, exitCode: lintResult.exitCode ?? 1 },
		check: {
			passed: checkResult.ok,
			violations: checkResult.violations.length,
		},
		duration_ms,
	};
}
