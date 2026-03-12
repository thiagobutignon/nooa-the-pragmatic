import { describe, expect, it } from "bun:test";
import { splitBacklogStories } from "./split";
import type { BacklogPrd } from "./types";

function createPrd(): BacklogPrd {
	return {
		project: "NOOA",
		branchName: "feature/perf-story",
		description: "Profile-heavy backlog",
		userStories: [
			{
				id: "US-001",
				title: "Improve API latency",
				description: "Reduce latency in the hot path",
				acceptanceCriteria: ["AC-1", "AC-2", "AC-3", "AC-4"],
				profileCommand: ["node", "scripts/profile-api.js"],
				priority: 1,
				passes: false,
				state: "pending",
			},
		],
	};
}

describe("backlog split", () => {
	it("splits oversized stories by acceptance criteria and preserves profileCommand", () => {
		const result = splitBacklogStories(createPrd(), {
			maxAcceptanceCriteria: 2,
		});

		expect(result.splitStories).toEqual(["US-001"]);
		expect(result.prd.userStories).toHaveLength(2);
		expect(result.prd.userStories[0]?.id).toBe("US-001.1");
		expect(result.prd.userStories[0]?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
		expect(result.prd.userStories[1]?.id).toBe("US-001.2");
		expect(result.prd.userStories[1]?.acceptanceCriteria).toEqual([
			"AC-3",
			"AC-4",
		]);
	});

	it("rejects splits that would exceed the story budget", () => {
		expect(() =>
			splitBacklogStories(createPrd(), {
				maxAcceptanceCriteria: 1,
				maxStories: 3,
			}),
		).toThrow("Backlog split would create 4 stories, above maxStories=3");
	});
});
