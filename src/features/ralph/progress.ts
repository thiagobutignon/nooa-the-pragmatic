import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ReplayGraph } from "../replay/graph";
import { loadReplay, type ReplayNode, saveReplay } from "../replay/storage";
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

function buildReplayLabel(record: RalphProgressEntry) {
	return `${record.storyId} [${record.status}]`;
}

function buildReplaySummary(record: RalphProgressEntry) {
	const parts = [
		`run=${record.runId}`,
		`story=${record.storyId}`,
		`iteration=${record.iteration}`,
		`status=${record.status}`,
		record.commit ? `commit=${record.commit}` : undefined,
	];
	return parts.filter(Boolean).join(" ");
}

function buildReplayTags(record: RalphProgressEntry) {
	return [
		"ralph",
		`run:${record.runId}`,
		`story:${record.storyId}`,
		`status:${record.status}`,
		`iteration:${record.iteration}`,
	];
}

function findLatestStoryReplayNode(
	nodes: ReplayNode[],
	record: RalphProgressEntry,
): ReplayNode | null {
	const matchingNodes = nodes.filter((node) =>
		node.meta?.tags?.includes(`story:${record.storyId}`),
	);
	if (matchingNodes.length === 0) {
		return null;
	}
	return matchingNodes.reduce((latest, current) =>
		current.createdAt > latest.createdAt ? current : latest,
	);
}

async function appendRalphReplayProgress(
	root: string,
	record: RalphProgressEntry,
): Promise<void> {
	const data = await loadReplay(root);
	const previousNode = findLatestStoryReplayNode(data.nodes, record);
	const graph = new ReplayGraph(data);
	const node = graph.addNode(buildReplayLabel(record), "step", {
		summary: buildReplaySummary(record),
		tags: buildReplayTags(record),
	});
	if (previousNode) {
		graph.addEdge(previousNode.id, node.id, "next");
	}
	await saveReplay(root, graph.toJSON());
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
	await appendRalphReplayProgress(root, record);

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
