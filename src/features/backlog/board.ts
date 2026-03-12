import type { BacklogPrd, BacklogStory } from "./types";
import { assertBacklogPrd } from "./validate";

export type BacklogBoardColumnId = "todo" | "in_progress" | "in_review" | "done";

export interface BacklogBoardColumn {
	id: BacklogBoardColumnId;
	title: string;
	stories: BacklogStory[];
}

const BOARD_COLUMNS: Array<{ id: BacklogBoardColumnId; title: string }> = [
	{ id: "todo", title: "Todo" },
	{ id: "in_progress", title: "In Progress" },
	{ id: "in_review", title: "In Review" },
	{ id: "done", title: "Done" },
];

export function isBacklogBoardColumnId(
	value: string,
): value is BacklogBoardColumnId {
	return BOARD_COLUMNS.some((column) => column.id === value);
}

function getBoardColumnForState(state: string): BacklogBoardColumnId {
	if (state === "passed") {
		return "done";
	}
	if (state === "implementing" || state === "verifying") {
		return "in_progress";
	}
	if (/^peer_review_/.test(state) || state === "approved" || state === "committed") {
		return "in_review";
	}
	return "todo";
}

function getStateForBoardColumn(column: BacklogBoardColumnId): string {
	switch (column) {
		case "todo":
			return "pending";
		case "in_progress":
			return "implementing";
		case "in_review":
			return "peer_review_1";
		case "done":
			return "passed";
	}
}

function isAllowedBoardTransition(
	from: BacklogBoardColumnId,
	to: BacklogBoardColumnId,
): boolean {
	if (from === to) {
		return true;
	}
	const allowed: Record<BacklogBoardColumnId, BacklogBoardColumnId[]> = {
		todo: ["in_progress"],
		in_progress: ["todo", "in_review"],
		in_review: ["in_progress", "done"],
		done: [],
	};
	return allowed[from].includes(to);
}

export function renderBacklogBoard(input: BacklogPrd): BacklogBoardColumn[] {
	const prd = assertBacklogPrd(input);
	return BOARD_COLUMNS.map((column) => ({
		...column,
		stories: prd.userStories.filter(
			(story) => getBoardColumnForState(story.state) === column.id,
		),
	}));
}

export function moveBacklogStory(
	input: BacklogPrd,
	storyId: string,
	targetColumn: BacklogBoardColumnId,
): BacklogPrd {
	const prd = assertBacklogPrd(input);
	const storyIndex = prd.userStories.findIndex((story) => story.id === storyId);
	if (storyIndex === -1) {
		throw new Error(`Backlog story not found: ${storyId}`);
	}

	const story = prd.userStories[storyIndex];
	if (!story) {
		throw new Error(`Backlog story not found: ${storyId}`);
	}

	const sourceColumn = getBoardColumnForState(story.state);
	if (!isAllowedBoardTransition(sourceColumn, targetColumn)) {
		throw new Error(
			`Invalid backlog move: ${story.id} cannot move from ${sourceColumn} to ${targetColumn}`,
		);
	}

	const nextState = getStateForBoardColumn(targetColumn);
	const nextStory: BacklogStory = {
		...story,
		state: nextState,
		passes: targetColumn === "done" ? true : false,
	};

	const nextStories = [...prd.userStories];
	nextStories[storyIndex] = nextStory;

	return assertBacklogPrd({
		...prd,
		userStories: nextStories,
	});
}
