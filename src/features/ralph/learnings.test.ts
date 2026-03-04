import { describe, expect, test } from "bun:test";
import {
	buildRalphLearningCandidate,
	classifyRalphLearning,
	getRalphLearningPromotion,
	scoreRalphLearning,
} from "./learnings";

describe("ralph learnings", () => {
	test("classifies story-local learnings by default", () => {
		expect(
			classifyRalphLearning({
				text: "Only this story needed a one-off fixture tweak",
			}),
		).toBe("story-local");
	});

	test("classifies repo-local, doc-local, and skill-local learnings", () => {
		expect(
			classifyRalphLearning({
				text: "This command always needs workflow plus ci before review",
				affectsReusablePattern: true,
			}),
		).toBe("repo-local");

		expect(
			classifyRalphLearning({
				text: "Document the replay fixture caveat in docs",
				docRelated: true,
			}),
		).toBe("doc-local");

		expect(
			classifyRalphLearning({
				text: "Future agents need a dedicated skill for reviewer identity rules",
				skillRelated: true,
			}),
		).toBe("skill-local");
	});

	test("scores learnings with additive and subtractive heuristics", () => {
		expect(
			scoreRalphLearning({
				text: "Need gate+ci before review",
				observedInStories: 2,
				preventedFailure: true,
				affectsReusablePattern: true,
				peerReviewed: true,
			}),
		).toBe(10);

		expect(
			scoreRalphLearning({
				text: "Temporary local workaround",
				temporary: true,
				localOnly: true,
			}),
		).toBe(-5);
	});

	test("keeps low-score learnings in progress only", () => {
		expect(getRalphLearningPromotion(2, "story-local")).toBe("progress_only");
		expect(getRalphLearningPromotion(5, "repo-local")).toBe("progress_only");
	});

	test("surfaces high-score learnings as promotion candidates", () => {
		expect(getRalphLearningPromotion(7, "repo-local")).toBe("candidate_agents");
		expect(getRalphLearningPromotion(7, "doc-local")).toBe("candidate_docs");
		expect(getRalphLearningPromotion(10, "skill-local")).toBe(
			"candidate_skill",
		);
	});

	test("builds promotion candidates with peer review requirement", () => {
		const candidate = buildRalphLearningCandidate({
			text: "Reviewer confirmed the same command pattern twice",
			observedInStories: 2,
			preventedFailure: true,
			affectsReusablePattern: true,
			peerReviewed: true,
		});

		expect(candidate.scope).toBe("repo-local");
		expect(candidate.score).toBe(10);
		expect(candidate.promotion).toBe("candidate_agents");
		expect(candidate.requiresPeerReview).toBe(true);
	});
});
