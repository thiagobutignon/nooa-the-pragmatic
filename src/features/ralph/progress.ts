import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RalphLearningCandidate } from "./learnings";

export interface RalphProgressEntry {
	timestamp?: string;
	runId: string;
	storyId: string;
	iteration: number;
	status: "passed" | "failed" | "blocked" | "approved" | "reviewing";
	commit?: string;
	reviewRounds?: number;
	reviewers?: string[];
	gates?: {
		workflow?: boolean;
		ci?: boolean;
		review?: boolean;
	};
	learnings?: RalphLearningCandidate[];
	notes?: string[];
}

export function getRalphProgressPath(root: string) {
	return join(root, ".nooa", "ralph", "progress.md");
}

export function getRalphProgressJsonlPath(root: string) {
	return join(root, ".nooa", "ralph", "progress.jsonl");
}

export async function appendRalphProgressEntry(
	root: string,
	entry: RalphProgressEntry,
): Promise<RalphProgressEntry> {
	const dir = join(root, ".nooa", "ralph");
	await mkdir(dir, { recursive: true });
	const record: RalphProgressEntry = {
		...entry,
		timestamp: entry.timestamp ?? new Date().toISOString(),
	};

	const markdownPath = getRalphProgressPath(root);
	const jsonlPath = getRalphProgressJsonlPath(root);

	let currentMarkdown = "";
	try {
		currentMarkdown = await readFile(markdownPath, "utf-8");
	} catch {
		currentMarkdown = "# Ralph Progress\n\n";
	}

	const markdownBlock = [
		`## ${record.timestamp} - ${record.storyId}`,
		`- Run: ${record.runId}`,
		`- Iteration: ${record.iteration}`,
		`- Status: ${record.status}`,
		record.reviewRounds ? `- Review Rounds: ${record.reviewRounds}` : undefined,
		record.reviewers?.length
			? `- Reviewers: ${record.reviewers.join(", ")}`
			: undefined,
		record.learnings?.length
			? `- Learnings: ${record.learnings
					.map(
						(learning) =>
							`${learning.text} [${learning.scope} -> ${learning.promotion} @ ${learning.score}]`,
					)
					.join("; ")}`
			: undefined,
		record.notes?.map((note) => `- ${note}`).join("\n"),
		"",
	].filter(Boolean);

	const nextMarkdown = `${currentMarkdown}${markdownBlock.join("\n")}\n`;
	const markdownTmp = `${markdownPath}.tmp`;
	await writeFile(markdownTmp, nextMarkdown);
	await rename(markdownTmp, markdownPath);

	let existingJsonl = "";
	try {
		existingJsonl = await readFile(jsonlPath, "utf-8");
	} catch {
		existingJsonl = "";
	}
	const jsonlTmp = `${jsonlPath}.tmp`;
	await writeFile(jsonlTmp, `${existingJsonl}${JSON.stringify(record)}\n`);
	await rename(jsonlTmp, jsonlPath);

	return record;
}

export async function loadRalphProgressEntries(
	root: string,
): Promise<RalphProgressEntry[]> {
	try {
		const raw = await readFile(getRalphProgressJsonlPath(root), "utf-8");
		return raw
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => JSON.parse(line) as RalphProgressEntry);
	} catch {
		return [];
	}
}
