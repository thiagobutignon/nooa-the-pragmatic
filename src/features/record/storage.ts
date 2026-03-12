import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface RecordArtifact {
	recordId: string;
	traceId: string;
	command: string[];
	cwd: string;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	exitCode: number | null;
	signal: string | null;
	stdout: string;
	stderr: string;
	env: Record<string, string>;
	filesTouched: string[];
}

export function getRecordPath(root: string, recordId: string) {
	return join(root, ".nooa", "records", `${recordId}.json`);
}

export async function loadRecord(
	root: string,
	recordId: string,
): Promise<RecordArtifact | null> {
	try {
		const raw = await readFile(getRecordPath(root, recordId), "utf-8");
		return JSON.parse(raw) as RecordArtifact;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.toLowerCase().includes("no such file")) {
			return null;
		}
		throw error;
	}
}

export async function saveRecord(root: string, record: RecordArtifact) {
	const dir = join(root, ".nooa", "records");
	await mkdir(dir, { recursive: true });
	await writeFile(getRecordPath(root, record.recordId), JSON.stringify(record, null, 2));
}
