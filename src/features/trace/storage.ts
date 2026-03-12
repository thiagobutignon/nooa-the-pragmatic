import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface TraceArtifact {
	traceId: string;
	parentTraceId: string | null;
	spanId: string;
	command: string[];
	cwd: string;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	exitCode: number | null;
	signal: string | null;
	stdoutSummary: string;
	stderrSummary: string;
	subprocesses: Array<{
		command: string[];
		pid?: number;
	}>;
	filesTouched: string[];
	links: {
		debugSession?: string;
		profilePath?: string;
		recordId?: string;
		replayNodeId?: string;
	};
}

export function getTracePath(root: string, traceId: string) {
	return join(root, ".nooa", "traces", `${traceId}.json`);
}

export async function loadTrace(
	root: string,
	traceId: string,
): Promise<TraceArtifact | null> {
	try {
		const raw = await readFile(getTracePath(root, traceId), "utf-8");
		return JSON.parse(raw) as TraceArtifact;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.toLowerCase().includes("no such file")) {
			return null;
		}
		throw error;
	}
}

export async function saveTrace(root: string, trace: TraceArtifact) {
	const dir = join(root, ".nooa", "traces");
	await mkdir(dir, { recursive: true });
	await writeFile(getTracePath(root, trace.traceId), JSON.stringify(trace, null, 2));
}

export async function updateTrace(
	root: string,
	traceId: string,
	updater: (trace: TraceArtifact) => TraceArtifact,
) {
	const current = await loadTrace(root, traceId);
	if (!current) {
		throw new Error(`Trace not found: ${traceId}`);
	}
	await saveTrace(root, updater(current));
}
