import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { execa } from "execa";
import { PolicyEngine } from "../../core/policy/PolicyEngine";

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

export async function executeCi(options: CiOptions, bus?: any): Promise<CiResult> {
    const traceId = createTraceId();
    const startTime = Date.now();

    // 1. Run Tests
    const testResult = await execa("bun", ["test"], { reject: false, cwd: process.cwd() });
    const testPassed = testResult.exitCode === 0;

    // 2. Run Lint (biome check)
    const lintResult = await execa("bun", ["run", "check"], { reject: false, cwd: process.cwd() });
    const lintPassed = lintResult.exitCode === 0;

    // 3. Run Policy Check
    const engine = new PolicyEngine(process.cwd());
    const { stdout } = await execa("git", ["ls-files"], { cwd: process.cwd() });
    const files = stdout.split("\n").filter(f => f.endsWith(".ts") && !f.includes("node_modules"));
    const checkResult = await engine.checkFiles(files);

    const duration_ms = Date.now() - startTime;
    const ok = testPassed && lintPassed && checkResult.ok;

    // Telemetry
    telemetry.track({
        event: ok ? "ci.success" : "ci.failure",
        level: ok ? "info" : "warn",
        success: ok,
        duration_ms,
        trace_id: traceId,
        metadata: {
            test_passed: testPassed,
            lint_passed: lintPassed,
            policy_violations: checkResult.violations.length
        }
    }, bus);

    return {
        ok,
        traceId,
        test: { passed: testPassed, exitCode: testResult.exitCode ?? 1, output: testResult.stdout },
        lint: { passed: lintPassed, exitCode: lintResult.exitCode ?? 1 },
        check: { passed: checkResult.ok, violations: checkResult.violations.length },
        duration_ms
    };
}
