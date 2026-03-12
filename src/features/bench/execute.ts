import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult } from "../../core/types";
import { runTrace } from "../trace/execute";
import { saveBench, type BenchArtifact } from "./storage";

export interface BenchInspectInput {
	action?: "inspect";
	command?: string[];
	runs?: number;
	cwd?: string;
}

export interface BenchInspectResult extends BenchArtifact {
	mode: "inspect";
}

function median(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
	}
	return sorted[middle] ?? 0;
}

export async function executeBenchInspect(
	input: BenchInspectInput,
): Promise<BenchInspectResult> {
	const cwd = input.cwd ?? process.cwd();
	const runs = input.runs && input.runs > 0 ? input.runs : 3;
	const startedAt = new Date().toISOString();
	const durations: number[] = [];
	const traceIds: string[] = [];
	let successes = 0;

	for (let index = 0; index < runs; index += 1) {
		const traceResult = await runTrace({
			action: "inspect",
			command: input.command,
			cwd,
		});
		if (!traceResult.ok) {
			throw new Error(traceResult.error.message);
		}
		durations.push(traceResult.data.durationMs);
		traceIds.push(traceResult.data.traceId);
		if (traceResult.data.exitCode === 0) {
			successes += 1;
		}
	}

	const benchId = createTraceId();
	const artifact: BenchInspectResult = {
		mode: "inspect",
		benchId,
		command: input.command ?? [],
		cwd,
		runs,
		startedAt,
		finishedAt: new Date().toISOString(),
		durationStats: {
			minMs: Math.min(...durations),
			medianMs: median(durations),
			maxMs: Math.max(...durations),
		},
		successRate: runs === 0 ? 0 : successes / runs,
		traceIds,
	};

	await saveBench(cwd, artifact);
	return artifact;
}

export async function runBenchInspect(
	input: BenchInspectInput,
): Promise<SdkResult<BenchInspectResult>> {
	if (input.action !== "inspect") {
		return {
			ok: false,
			error: sdkError("bench.missing_subcommand", "Missing subcommand."),
		};
	}

	if (!input.command?.length) {
		return {
			ok: false,
			error: sdkError(
				"bench.invalid_target",
				"Unsupported or missing runtime command.",
			),
		};
	}

	try {
		return {
			ok: true,
			data: await executeBenchInspect(input),
		};
	} catch (error) {
		return {
			ok: false,
			error: sdkError(
				"bench.runtime_error",
				error instanceof Error ? error.message : String(error),
			),
		};
	}
}
