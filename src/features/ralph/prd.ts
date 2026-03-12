import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RalphStoryRecord } from "./state";

export type RalphStory = RalphStoryRecord;

export interface RalphPrd {
	project: string;
	branchName: string;
	description: string;
	userStories: RalphStory[];
}

export function getRalphPrdPath(root: string) {
	return join(root, ".nooa", "ralph", "prd.json");
}

function validateRalphProfileCommand(
	profileCommand: unknown,
	storyId: string,
): asserts profileCommand is string[] | undefined {
	if (profileCommand === undefined) {
		return;
	}
	if (
		!Array.isArray(profileCommand) ||
		profileCommand.length === 0 ||
		profileCommand.some(
			(segment) => typeof segment !== "string" || segment.trim().length === 0,
		)
	) {
		throw new Error(
			`Invalid Ralph PRD: story ${storyId} must use profileCommand as a non-empty string array`,
		);
	}
}

export function validateRalphPrd(prd: RalphPrd): RalphPrd {
	if (!Array.isArray(prd.userStories)) {
		throw new Error("Invalid Ralph PRD: userStories must be an array");
	}

	for (const story of prd.userStories) {
		validateRalphProfileCommand(story.profileCommand, story.id);
	}

	return prd;
}

export function parseRalphPrd(raw: string): RalphPrd {
	return validateRalphPrd(JSON.parse(raw) as RalphPrd);
}

export async function loadRalphPrd(root: string): Promise<RalphPrd> {
	const raw = await readFile(getRalphPrdPath(root), "utf-8");
	return parseRalphPrd(raw);
}

export async function saveRalphPrd(root: string, prd: RalphPrd): Promise<void> {
	const path = getRalphPrdPath(root);
	await mkdir(join(root, ".nooa", "ralph"), { recursive: true });
	const tmpPath = `${path}.tmp`;
	await writeFile(tmpPath, JSON.stringify(prd, null, 2));
	await rename(tmpPath, path);
}
