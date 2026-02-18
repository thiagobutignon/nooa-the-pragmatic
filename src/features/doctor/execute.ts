import { type ExecaChildProcess, execa as defaultExeca } from "execa";
import type { EventBus } from "../../core/event-bus";
import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

export interface ToolCheck {
	available: boolean;
	version?: string;
}

export interface DoctorResult {
	ok: boolean;
	traceId: string;
	bun: ToolCheck;
	git: ToolCheck;
	rg: ToolCheck;
	sqlite: ToolCheck;
	duration_ms: number;
}

// Define specific type for execa to match what we use
type ExecaType = (
	file: string,
	args?: readonly string[],
	options?: any,
) => ExecaChildProcess<string> | Promise<any>;

async function checkTool(
	cmd: string,
	args: string[],
	executor: ExecaType,
): Promise<ToolCheck> {
	try {
		// Use which to check existence first to avoid hangs on some environments
		const which = await executor("which", [cmd], { reject: false });
		if (which.exitCode !== 0) {
			return { available: false };
		}

		const { stdout } = await executor(cmd, args, { timeout: 3000 });
		return {
			available: true,
			version: stdout.trim().split("\n")[0] || "Found",
		};
	} catch (_e) {
		return { available: false };
	}
}

export async function executeDoctorCheck(
	bus?: EventBus,
	executor: ExecaType = defaultExeca as any,
): Promise<DoctorResult> {
	const traceId = createTraceId();
	const startTime = Date.now();

	const bun = await checkTool("bun", ["--version"], executor);
	const git = await checkTool("git", ["--version"], executor);
	const rg = await checkTool("rg", ["--version"], executor);
	const sqlite = await checkTool("sqlite3", ["--version"], executor);

	const ok = bun.available && git.available && rg.available && sqlite.available;
	const duration_ms = Date.now() - startTime;

	telemetry.track(
		{
			event: ok ? "doctor.success" : "doctor.failure",
			level: ok ? "info" : "warn",
			success: ok,
			duration_ms,
			trace_id: traceId,
			metadata: {
				bun_available: bun.available,
				git_available: git.available,
				rg_available: rg.available,
				sqlite_available: sqlite.available,
			},
		},
		bus,
	);

	return {
		ok,
		traceId,
		bun,
		git,
		rg,
		sqlite,
		duration_ms,
	};
}
