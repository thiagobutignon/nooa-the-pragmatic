import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	executeRalphApproveStory,
	executeRalphPromoteLearning,
	executeRalphReviewStory,
	initializeRalphRun,
} from "./execute";
import { type RalphPrd, saveRalphPrd } from "./prd";
import { appendRalphProgressEntry } from "./progress";
import { loadRalphState, saveRalphState } from "./state";

async function createTempRepo() {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-subcommands-"));
	await writeFile(join(root, ".gitignore"), ".nooa/ralph/\n");
	return root;
}

function createPeerReviewPrd(): RalphPrd {
	return {
		project: "NOOA",
		branchName: "feature/ralph-subcommands",
		description: "Ralph subcommand fixture",
		userStories: [
			{
				id: "US-001",
				title: "Reviewable story",
				description: "Review and approve me",
				acceptanceCriteria: ["approved"],
				priority: 1,
				passes: false,
				notes: "",
				state: "peer_review_1",
			},
		],
	};
}

function createReviewableStory(
	overrides?: Partial<RalphPrd["userStories"][number]>,
) {
	return {
		id: "US-001",
		title: "Reviewable story",
		description: "Review and approve me",
		acceptanceCriteria: ["approved"],
		priority: 1,
		passes: false,
		notes: "",
		state: "peer_review_1" as const,
		...overrides,
	};
}

describe("ralph subcommands", () => {
	test("review subcommand runs peer review for a specific story", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-subcommands",
				branchName: "feature/ralph-subcommands",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPeerReviewPrd());

			const result = await executeRalphReviewStory(
				{ root, storyId: "US-001" },
				{
					setGoal: async () => {},
					runWorker: async () => ({ ok: true, finalAnswer: "fixed" }),
					runReview: async () => ({
						ok: true,
						findings: [],
						summary: "Approved directly",
					}),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(result.state).toBe("passed");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("approve subcommand marks a reviewed story as passed", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-approve",
				branchName: "feature/ralph-approve",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPeerReviewPrd());

			const result = await executeRalphApproveStory({
				root,
				storyId: "US-001",
				notes: ["Manual approval for controlled test"],
			});

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(result.state).toBe("passed");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("approve subcommand rejects stories that are not awaiting peer review", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-approve-invalid",
				branchName: "feature/ralph-approve-invalid",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPeerReviewPrd(),
				userStories: [
					{
						...createReviewableStory(),
						state: "implementing",
					},
				],
			});

			await expect(
				executeRalphApproveStory({
					root,
					storyId: "US-001",
				}),
			).rejects.toThrow("not awaiting peer review");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("promote-learning subcommand returns learning candidates for a story", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-promote",
				branchName: "feature/ralph-promote",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPeerReviewPrd());
			await appendRalphProgressEntry(root, {
				runId: "ralph-promote",
				storyId: "US-001",
				iteration: 1,
				status: "approved",
				learnings: [
					{
						text: "This command requires gate+ci before review",
						scope: "repo-local",
						score: 8,
						promotion: "candidate_agents",
						requiresPeerReview: true,
					},
				],
			});

			const result = await executeRalphPromoteLearning({
				root,
				storyId: "US-001",
			});

			expect(result.storyId).toBe("US-001");
			expect(result.candidates).toHaveLength(1);
			expect(result.candidates[0]?.promotion).toBe("candidate_agents");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("promote-learning falls back to currentStoryId when storyId is omitted", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-promote-current",
				branchName: "feature/ralph-promote-current",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPeerReviewPrd());
			const state = await loadRalphState(root);
			if (!state) {
				throw new Error("Expected Ralph state to exist");
			}
			state.currentStoryId = "US-001";
			await saveRalphState(root, state);
			await appendRalphProgressEntry(root, {
				runId: "ralph-promote-current",
				storyId: "US-001",
				iteration: 1,
				status: "approved",
				learnings: [
					{
						text: "Keep replay metadata attached to the story loop",
						scope: "doc-local",
						score: 7,
						promotion: "candidate_docs",
						requiresPeerReview: true,
					},
				],
			});

			const result = await executeRalphPromoteLearning({ root });

			expect(result.storyId).toBe("US-001");
			expect(result.candidates).toHaveLength(1);
			expect(result.candidates[0]?.promotion).toBe("candidate_docs");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("review and learning subcommands fail clearly without an active run", async () => {
		const root = await createTempRepo();

		try {
			await expect(
				executeRalphReviewStory({ root, storyId: "US-001" }),
			).rejects.toThrow("No active Ralph run");
			await expect(
				executeRalphPromoteLearning({ root, storyId: "US-001" }),
			).rejects.toThrow("No active Ralph run");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
