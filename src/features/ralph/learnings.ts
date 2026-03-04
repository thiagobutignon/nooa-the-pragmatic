export type RalphLearningScope =
	| "story-local"
	| "repo-local"
	| "skill-local"
	| "doc-local";

export type RalphLearningPromotion =
	| "progress_only"
	| "candidate_agents"
	| "candidate_docs"
	| "candidate_skill";

export interface RalphLearningInput {
	text: string;
	observedInStories?: number;
	preventedFailure?: boolean;
	affectsReusablePattern?: boolean;
	peerReviewed?: boolean;
	temporary?: boolean;
	localOnly?: boolean;
	docRelated?: boolean;
	skillRelated?: boolean;
	scopeHint?: RalphLearningScope;
}

export interface RalphLearningCandidate {
	text: string;
	scope: RalphLearningScope;
	score: number;
	promotion: RalphLearningPromotion;
	requiresPeerReview: boolean;
}

export function classifyRalphLearning(
	input: RalphLearningInput,
): RalphLearningScope {
	if (input.scopeHint) {
		return input.scopeHint;
	}
	if (input.skillRelated) {
		return "skill-local";
	}
	if (input.docRelated) {
		return "doc-local";
	}
	if (input.affectsReusablePattern) {
		return "repo-local";
	}
	return "story-local";
}

export function scoreRalphLearning(input: RalphLearningInput): number {
	let score = 0;

	if ((input.observedInStories ?? 1) >= 2) {
		score += 3;
	}
	if (input.preventedFailure) {
		score += 3;
	}
	if (input.affectsReusablePattern) {
		score += 2;
	}
	if (input.peerReviewed) {
		score += 2;
	}
	if (input.temporary) {
		score -= 3;
	}
	if (input.localOnly) {
		score -= 2;
	}

	return score;
}

export function getRalphLearningPromotion(
	score: number,
	scope: RalphLearningScope,
): RalphLearningPromotion {
	if (score <= 5 || scope === "story-local") {
		return "progress_only";
	}

	if (score >= 9) {
		if (scope === "skill-local") {
			return "candidate_skill";
		}
		if (scope === "doc-local") {
			return "candidate_docs";
		}
		return "candidate_agents";
	}

	if (scope === "doc-local") {
		return "candidate_docs";
	}

	return "candidate_agents";
}

export function buildRalphLearningCandidate(
	input: RalphLearningInput,
): RalphLearningCandidate {
	const scope = classifyRalphLearning(input);
	const score = scoreRalphLearning(input);
	const promotion = getRalphLearningPromotion(score, scope);
	return {
		text: input.text,
		scope,
		score,
		promotion,
		requiresPeerReview: promotion !== "progress_only",
	};
}
