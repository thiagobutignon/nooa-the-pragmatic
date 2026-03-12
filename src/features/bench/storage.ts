import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface BenchArtifact {
	benchId: string;
	command: string[];
	cwd: string;
	runs: number;
	startedAt: string;
	finishedAt: string;
	durationStats: {
		minMs: number;
		medianMs: number;
		maxMs: number;
	};
	successRate: number;
	traceIds: string[];
}

export function getBenchPath(root: string, benchId: string) {
	return join(root, ".nooa", "bench", `${benchId}.json`);
}

export async function loadBench(
	root: string,
	benchId: string,
): Promise<BenchArtifact | null> {
	try {
		const raw = await readFile(getBenchPath(root, benchId), "utf-8");
		return JSON.parse(raw) as BenchArtifact;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.toLowerCase().includes("no such file")) {
			return null;
		}
		throw error;
	}
}

export async function saveBench(root: string, bench: BenchArtifact) {
	const dir = join(root, ".nooa", "bench");
	await mkdir(dir, { recursive: true });
	await writeFile(getBenchPath(root, bench.benchId), JSON.stringify(bench, null, 2));
}
