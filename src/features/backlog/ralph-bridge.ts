import { readFile } from "node:fs/promises";
import { loadRalphState } from "../ralph/state";
import type { RalphPrd } from "../ralph/prd";
import { saveRalphPrd } from "../ralph/prd";
import type { BacklogPrd } from "./types";
import { assertBacklogPrd } from "./validate";

export function convertBacklogToRalphPrd(input: BacklogPrd): RalphPrd {
	const prd = assertBacklogPrd(input);

	return {
		project: prd.project,
		branchName: prd.branchName,
		description: prd.description,
		userStories: prd.userStories.map((story) => ({
			id: story.id,
			title: story.title,
			description: story.description,
			acceptanceCriteria: story.acceptanceCriteria,
			profileCommand: story.profileCommand,
			priority: story.priority,
			passes: story.passes,
			notes: "",
			state: story.state as RalphPrd["userStories"][number]["state"],
		})),
	};
}

export async function importBacklogIntoRalph(input: {
	root: string;
	path: string;
}): Promise<RalphPrd> {
	const state = await loadRalphState(input.root);
	if (!state) {
		throw new Error(
			"Initialize Ralph with `nooa ralph init` before importing a backlog PRD",
		);
	}
	const raw = await readFile(input.path, "utf8");
	const backlogPrd = JSON.parse(raw) as BacklogPrd;
	const ralphPrd = convertBacklogToRalphPrd(backlogPrd);
	await saveRalphPrd(input.root, ralphPrd);
	return ralphPrd;
}
