import { describe, expect, test } from "bun:test";
import {
	assertDistinctRalphReviewerIdentity,
	createDefaultRalphState,
	getAllowedRalphStoryTransitions,
	markRalphStoryApproved,
	type RalphStoryRecord,
	recordRalphPeerReview,
	transitionRalphStoryState,
} from "./state";

function createStory(
	state: RalphStoryRecord["state"] = "pending",
): RalphStoryRecord {
	return {
		id: "US-001",
		title: "Auth state",
		description: "Persist auth state",
		acceptanceCriteria: ["Tests pass"],
		priority: 1,
		passes: false,
		notes: "",
		state,
	};
}

describe("ralph story state machine", () => {
	test("transitions from pending to implementing", () => {
		const story = createStory("pending");
		expect(getAllowedRalphStoryTransitions("pending")).toContain(
			"implementing",
		);
		expect(transitionRalphStoryState(story, "implementing").state).toBe(
			"implementing",
		);
	});

	test("transitions from verifying to the first peer review round", () => {
		const story = createStory("verifying");
		const nextStory = transitionRalphStoryState(story, "peer_review_1");
		expect(nextStory.state).toBe("peer_review_1");
	});

	test("records requested changes and moves into peer_fix_1", () => {
		const story = createStory("peer_review_1");
		const reviewed = recordRalphPeerReview(story, {
			reviewer: { provider: "anthropic", model: "claude-3.7", temperature: 0 },
			approved: false,
			recordedAt: "2026-03-03T21:00:00.000Z",
			notes: ["Add missing TDD evidence"],
		});

		expect(reviewed.state).toBe("peer_fix_1");
		expect(reviewed.review?.rounds).toBe(1);
		expect(reviewed.review?.records[0]?.verdict).toBe("changes_requested");
		expect(reviewed.review?.records[0]?.notes).toContain(
			"Add missing TDD evidence",
		);
	});

	test("supports second and third review rounds before approval", () => {
		const firstFix = createStory("peer_fix_1");
		const secondReview = transitionRalphStoryState(firstFix, "peer_review_2");
		const secondFix = recordRalphPeerReview(secondReview, {
			reviewer: { provider: "anthropic", model: "claude-3.7" },
			approved: false,
			recordedAt: "2026-03-03T21:01:00.000Z",
		});
		const thirdReview = transitionRalphStoryState(secondFix, "peer_review_3");
		const approved = markRalphStoryApproved(thirdReview, {
			reviewer: { provider: "openai", model: "gpt-5-review", temperature: 0 },
			recordedAt: "2026-03-03T21:02:00.000Z",
			notes: ["Approved after final pass"],
		});

		expect(secondFix.state).toBe("peer_fix_2");
		expect(thirdReview.state).toBe("peer_review_3");
		expect(approved.state).toBe("approved");
		expect(approved.review?.rounds).toBe(3);
		expect(approved.review?.records).toHaveLength(2);
		expect(approved.review?.approvedAt).toBe("2026-03-03T21:02:00.000Z");
	});

	test("blocks the story after a third rejected review round", () => {
		const story = createStory("peer_review_3");
		const blocked = recordRalphPeerReview(story, {
			reviewer: { provider: "anthropic", model: "claude-3.7" },
			approved: false,
		});

		expect(blocked.state).toBe("blocked");
		expect(blocked.review?.records[0]?.round).toBe(3);
	});

	test("requires approval and commit before a story can pass", () => {
		const approved = createStory("approved");
		expect(() => transitionRalphStoryState(approved, "passed")).toThrow(
			"Invalid Ralph story transition",
		);

		const committed = transitionRalphStoryState(approved, "committed");
		const passed = transitionRalphStoryState(committed, "passed");

		expect(passed.state).toBe("passed");
		expect(passed.passes).toBe(true);
	});

	test("rejects identical worker and reviewer identities in strict mode", () => {
		const state = createDefaultRalphState({
			runId: "ralph-auth",
			branchName: "feature/ralph-auth",
			workerProvider: "openai",
			workerModel: "gpt-5-codex",
			reviewerProvider: "openai",
			reviewerModel: "gpt-5-codex",
		});

		expect(() =>
			assertDistinctRalphReviewerIdentity(state, { strict: true }),
		).toThrow("different provider/model identities in strict mode");
	});
});
