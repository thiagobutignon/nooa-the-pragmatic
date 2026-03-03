import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RalphStoryState } from "./state";

export interface RalphStory {
	id: string;
	title: string;
	description: string;
	acceptanceCriteria: string[];
	priority: number;
	passes: boolean;
	notes: string;
	state?: RalphStoryState;
}

export interface RalphPrd {
	project: string;
	branchName: string;
	description: string;
	userStories: RalphStory[];
}

export function getRalphPrdPath(root: string) {
	return join(root, ".nooa", "ralph", "prd.json");
}

export async function loadRalphPrd(root: string): Promise<RalphPrd> {
	const raw = await readFile(getRalphPrdPath(root), "utf-8");
	return JSON.parse(raw) as RalphPrd;
}

export async function saveRalphPrd(root: string, prd: RalphPrd): Promise<void> {
	const path = getRalphPrdPath(root);
	await mkdir(join(root, ".nooa", "ralph"), { recursive: true });
	const tmpPath = `${path}.tmp`;
	await writeFile(tmpPath, JSON.stringify(prd, null, 2));
	await rename(tmpPath, path);
}
