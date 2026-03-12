import { describe, expect, it } from "bun:test";
import { validateBacklogPrd } from "./validate";

describe("backlog validate", () => {
	it("returns ok true for a valid PRD payload", () => {
		const result = validateBacklogPrd({
			project: "Ralph Loop Backlog",
			branchName: "feature/ralph-loop",
			description: "Teste",
			userStories: [
				{
					id: "US-001",
					title: "Story",
					description: "Story description",
					acceptanceCriteria: ["AC-1"],
					profileCommand: ["node", "scripts/profile-story.js"],
					priority: 1,
					passes: false,
					state: "pending",
				},
			],
		});

		expect(result.ok).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("returns deterministic errors when acceptance criteria is missing", () => {
		const result = validateBacklogPrd({
			project: "Ralph Loop Backlog",
			branchName: "feature/ralph-loop",
			description: "Teste",
			userStories: [
				{
					id: "US-001",
					title: "Story",
					description: "Story description",
					acceptanceCriteria: [],
					priority: 1,
					passes: false,
					state: "pending",
				},
			],
		});

		expect(result.ok).toBe(false);
		expect(result.errors).toContain(
			"userStories[0].acceptanceCriteria must contain at least 1 item",
		);
	});

	it("rejects invalid profileCommand payloads", () => {
		const result = validateBacklogPrd({
			project: "Ralph Loop Backlog",
			branchName: "feature/ralph-loop",
			description: "Teste",
			userStories: [
				{
					id: "US-001",
					title: "Story",
					description: "Story description",
					acceptanceCriteria: ["AC-1"],
					profileCommand: "node scripts/profile-story.js",
					priority: 1,
					passes: false,
					state: "pending",
				},
			],
		});

		expect(result.ok).toBe(false);
		expect(result.errors).toContain(
			"userStories[0].profileCommand must be an array when provided",
		);
	});

	it("rejects invalid story states", () => {
		const result = validateBacklogPrd({
			project: "Ralph Loop Backlog",
			branchName: "feature/ralph-loop",
			description: "Teste",
			userStories: [
				{
					id: "US-001",
					title: "Story",
					description: "Story description",
					acceptanceCriteria: ["AC-1"],
					priority: 1,
					passes: false,
					state: "review",
				},
			],
		});

		expect(result.ok).toBe(false);
		expect(result.errors).toContain(
			"userStories[0].state must be one of: pending, implementing, verifying, peer_review_1, peer_fix_1, peer_review_2, peer_fix_2, peer_review_3, approved, committed, passed, failed, blocked",
		);
	});
});
