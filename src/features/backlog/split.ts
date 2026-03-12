import type { BacklogPrd, BacklogStory } from "./types";
import { assertBacklogPrd } from "./validate";

export interface SplitBacklogOptions {
	maxAcceptanceCriteria?: number;
	maxStories?: number;
}

export interface SplitBacklogResult {
	prd: BacklogPrd;
	splitStories: string[];
}

function splitStoryByAcceptanceCriteria(
	story: BacklogStory,
	maxAcceptanceCriteria: number,
): BacklogStory[] {
	if (story.acceptanceCriteria.length <= maxAcceptanceCriteria) {
		return [story];
	}

	const chunks: string[][] = [];
	for (let index = 0; index < story.acceptanceCriteria.length; index += maxAcceptanceCriteria) {
		chunks.push(story.acceptanceCriteria.slice(index, index + maxAcceptanceCriteria));
	}

	return chunks.map((acceptanceCriteria, index) => ({
		...story,
		id: `${story.id}.${index + 1}`,
		title: `${story.title} (Part ${index + 1}/${chunks.length})`,
		description: `${story.description}\n\nSplit from ${story.id} to keep acceptance criteria reviewable.`,
		acceptanceCriteria,
	}));
}

export function splitBacklogStories(
	input: BacklogPrd,
	options?: SplitBacklogOptions,
): SplitBacklogResult {
	const prd = assertBacklogPrd(input);
	const maxAcceptanceCriteria = options?.maxAcceptanceCriteria ?? 3;
	const maxStories = options?.maxStories ?? 20;

	if (maxAcceptanceCriteria < 1) {
		throw new Error("maxAcceptanceCriteria must be at least 1");
	}

	if (prd.userStories.length > maxStories) {
		throw new Error(
			`Backlog already has ${prd.userStories.length} stories, above maxStories=${maxStories}`,
		);
	}

	const splitStories: string[] = [];
	const userStories = prd.userStories.flatMap((story) => {
		const nextStories = splitStoryByAcceptanceCriteria(story, maxAcceptanceCriteria);
		if (nextStories.length > 1) {
			splitStories.push(story.id);
		}
		return nextStories;
	});

	if (userStories.length > maxStories) {
		throw new Error(
			`Backlog split would create ${userStories.length} stories, above maxStories=${maxStories}`,
		);
	}

	return {
		prd: assertBacklogPrd({
			...prd,
			userStories,
		}),
		splitStories,
	};
}
