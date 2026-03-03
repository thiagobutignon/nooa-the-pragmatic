import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	executeRalphReviewLoop,
	initializeRalphRun,
	type RalphReviewLoopAdapters,
} from "./execute";
import { type RalphPrd, saveRalphPrd } from "./prd";
import { appendRalphProgressEntry, loadRalphProgressEntries } from "./progress";
import { loadRalphState, saveRalphState } from "./state";

async function createTempRepo() {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-review-"));
	await writeFile(join(root, ".gitignore"), ".nooa/ralph/\n");
	return root;
}

function createReviewPrd(): RalphPrd {
	return {
		project: "NOOA",
		branchName: "feature/ralph-review",
		description: "Ralph review fixture",
		userStories: [
			{
				id: "US-001",
				title: "Peer review story",
				description: "Review me",
				acceptanceCriteria: ["Approved by reviewer"],
				priority: 1,
				passes: false,
				notes: "",
				state: "peer_review_1",
			},
		],
	};
}

async function seedReviewStory(
	root: string,
	options?: {
		workerProvider?: string;
		workerModel?: string;
		reviewerProvider?: string;
		reviewerModel?: string;
	},
) {
	await initializeRalphRun({
		root,
		runId: "ralph-review",
		branchName: "feature/ralph-review",
		workerProvider: options?.workerProvider ?? "openai",
		workerModel: options?.workerModel ?? "gpt-5-codex",
		reviewerProvider: options?.reviewerProvider ?? "anthropic",
		reviewerModel: options?.reviewerModel ?? "claude-3.7",
	});
	await saveRalphPrd(root, createReviewPrd());
	const state = await loadRalphState(root);
	if (!state) {
		throw new Error("Expected initialized Ralph state");
	}
	state.currentStoryId = "US-001";
	state.status = "running";
	await saveRalphState(root, state);
}

describe("ralph review loop", () => {
	test("approves on round 1 and uses reviewer-specific provider/model", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];

		try {
			await seedReviewStory(root);
			const result = await executeRalphReviewLoop(
				{ root },
				{
					setGoal: async () => {},
					runWorker: async () => ({ ok: true, finalAnswer: "fixed" }),
					runReview: async (input) => {
						calls.push(
							`review:${input.story.id}:${input.provider}:${input.model}:${input.temperature}`,
						);
						return { ok: true, findings: [], summary: "Looks good" };
					},
					appendProgress: appendRalphProgressEntry,
				},
			);

			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;
			const story = prd.userStories[0];

			expect(result.ok).toBe(true);
			expect(result.rounds).toBe(1);
			expect(story?.state).toBe("approved");
			expect(calls).toEqual(["review:US-001:anthropic:claude-3.7:0"]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("reviewer findings force a correction round before approval on round 2", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];
		let reviewCount = 0;

		try {
			await seedReviewStory(root);
			const adapters: RalphReviewLoopAdapters = {
				setGoal: async (goal) => {
					calls.push(`goal:${goal.includes("Address the reviewer findings")}`);
				},
				runWorker: async (input) => {
					calls.push(`worker:${input.story.state}`);
					return { ok: true, finalAnswer: "fixed" };
				},
				runReview: async (input) => {
					reviewCount += 1;
					calls.push(`review:${reviewCount}:${input.story.state}`);
					if (reviewCount === 1) {
						return {
							ok: false,
							findings: [{ severity: "high", message: "Add missing tests" }],
							summary: "Needs one correction",
						};
					}
					return { ok: true, findings: [], summary: "Approved on round 2" };
				},
				appendProgress: appendRalphProgressEntry,
			};

			const result = await executeRalphReviewLoop({ root }, adapters);
			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;
			const story = prd.userStories[0];
			const progress = await loadRalphProgressEntries(root);

			expect(result.ok).toBe(true);
			expect(result.rounds).toBe(2);
			expect(story?.state).toBe("approved");
			expect(progress.some((entry) => entry.status === "reviewing")).toBe(true);
			expect(calls).toEqual([
				"review:1:peer_review_1",
				"goal:true",
				"worker:peer_fix_1",
				"review:2:peer_review_2",
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("approval can happen on round 3", async () => {
		const root = await createTempRepo();
		let reviewCount = 0;

		try {
			await seedReviewStory(root);
			const result = await executeRalphReviewLoop(
				{ root },
				{
					setGoal: async () => {},
					runWorker: async () => ({ ok: true, finalAnswer: "fixed" }),
					runReview: async () => {
						reviewCount += 1;
						if (reviewCount < 3) {
							return {
								ok: false,
								findings: [
									{ severity: "medium", message: `Fix round ${reviewCount}` },
								],
							};
						}
						return { ok: true, findings: [], summary: "Approved on round 3" };
					},
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.rounds).toBe(3);
			expect(result.state).toBe("approved");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("rejection after round 3 blocks the story", async () => {
		const root = await createTempRepo();

		try {
			await seedReviewStory(root);
			const result = await executeRalphReviewLoop(
				{ root },
				{
					setGoal: async () => {},
					runWorker: async () => ({ ok: true, finalAnswer: "fixed" }),
					runReview: async () => ({
						ok: false,
						findings: [{ severity: "high", message: "Still broken" }],
						summary: "Rejected",
					}),
					appendProgress: appendRalphProgressEntry,
				},
			);

			const state = await loadRalphState(root);
			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;

			expect(result.ok).toBe(false);
			expect(result.rounds).toBe(3);
			expect(result.state).toBe("blocked");
			expect(state?.status).toBe("blocked");
			expect(prd.userStories[0]?.state).toBe("blocked");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("reviewer timeout fails cleanly", async () => {
		const root = await createTempRepo();

		try {
			await seedReviewStory(root);
			const result = await executeRalphReviewLoop(
				{ root },
				{
					setGoal: async () => {},
					runWorker: async () => ({ ok: true, finalAnswer: "fixed" }),
					runReview: async () => {
						throw new Error("Reviewer timeout after 120000ms");
					},
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(false);
			expect(result.reason).toContain("timeout");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("review loop rejects identical worker and reviewer identities", async () => {
		const root = await createTempRepo();

		try {
			await seedReviewStory(root, {
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "openai",
				reviewerModel: "gpt-5-codex",
			});

			await expect(
				executeRalphReviewLoop(
					{ root },
					{
						setGoal: async () => {},
						runWorker: async () => ({ ok: true, finalAnswer: "fixed" }),
						runReview: async () => ({ ok: true, findings: [] }),
						appendProgress: appendRalphProgressEntry,
					},
				),
			).rejects.toThrow("different provider/model identities in strict mode");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
