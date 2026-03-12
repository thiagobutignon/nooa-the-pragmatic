import { describe, expect, it } from "bun:test";
import { moveBacklogStory, renderBacklogBoard } from "./board";
import type { BacklogPrd } from "./types";

function createPrd(): BacklogPrd {
	return {
		project: "NOOA",
		branchName: "feature/backlog-board",
		description: "Board fixture",
		userStories: [
			{
				id: "US-001",
				title: "Todo story",
				description: "Pending work",
				acceptanceCriteria: ["AC-1"],
				priority: 1,
				passes: false,
				state: "pending",
			},
			{
				id: "US-002",
				title: "In progress story",
				description: "Implementation work",
				acceptanceCriteria: ["AC-2"],
				profileCommand: ["node", "scripts/profile-api.js"],
				priority: 2,
				passes: false,
				state: "implementing",
			},
			{
				id: "US-003",
				title: "Review story",
				description: "Review work",
				acceptanceCriteria: ["AC-3"],
				priority: 3,
				passes: false,
				state: "peer_review_1",
			},
			{
				id: "US-004",
				title: "Done story",
				description: "Finished work",
				acceptanceCriteria: ["AC-4"],
				priority: 4,
				passes: true,
				state: "passed",
			},
		],
	};
}

describe("backlog board", () => {
	it("renders deterministic board columns from story state", () => {
		const board = renderBacklogBoard(createPrd());

		expect(board.map((column) => column.title)).toEqual([
			"Todo",
			"In Progress",
			"In Review",
			"Done",
		]);
		expect(board[0]?.stories.map((story) => story.id)).toEqual(["US-001"]);
		expect(board[1]?.stories.map((story) => story.id)).toEqual(["US-002"]);
		expect(board[2]?.stories.map((story) => story.id)).toEqual(["US-003"]);
		expect(board[3]?.stories.map((story) => story.id)).toEqual(["US-004"]);
	});

	it("moves a story across valid board transitions without losing profileCommand", () => {
		const moved = moveBacklogStory(createPrd(), "US-002", "in_review");
		const story = moved.userStories.find((candidate) => candidate.id === "US-002");

		expect(story?.state).toBe("peer_review_1");
		expect(story?.passes).toBe(false);
		expect(story?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
	});

	it("rejects invalid board transitions", () => {
		expect(() => moveBacklogStory(createPrd(), "US-001", "done")).toThrow(
			"Invalid backlog move: US-001 cannot move from todo to done",
		);
	});
});
