import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	executeRalphStep,
	initializeRalphRun,
	type RalphStepAdapters,
} from "./execute";
import { type RalphPrd, saveRalphPrd } from "./prd";
import { appendRalphProgressEntry, loadRalphProgressEntries } from "./progress";
import { loadRalphState } from "./state";

async function createTempRepo() {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-step-"));
	await writeFile(join(root, ".gitignore"), ".nooa/ralph/\n");
	return root;
}

function createPrd(): RalphPrd {
	return {
		project: "NOOA",
		branchName: "feature/ralph-step",
		description: "Ralph step fixture",
		userStories: [
			{
				id: "US-002",
				title: "Lower priority",
				description: "Second story",
				acceptanceCriteria: ["passes"],
				priority: 2,
				passes: false,
				notes: "",
				state: "pending",
			},
			{
				id: "US-001",
				title: "Highest priority",
				description: "First story",
				acceptanceCriteria: ["passes"],
				priority: 1,
				passes: false,
				notes: "",
				state: "pending",
			},
		],
	};
}

describe("ralph step", () => {
	test("selects the highest-priority pending story, sets goal, runs worker, verifies, and moves to peer_review_1", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-step",
				branchName: "feature/ralph-step",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			const adapters: RalphStepAdapters = {
				setGoal: async (goal, cwd) => {
					calls.push(`goal:${cwd}:${goal}`);
				},
				runWorker: async (input) => {
					calls.push(
						`worker:${input.story.id}:${input.provider}:${input.model}:${input.turns}:${String(input.headless)}`,
					);
					return {
						ok: true,
						finalAnswer: "implemented",
					};
				},
				runWorkflow: async () => {
					calls.push("workflow");
					return { ok: true };
				},
				runCi: async () => {
					calls.push("ci");
					return { ok: true };
				},
				appendProgress: appendRalphProgressEntry,
			};

			const result = await executeRalphStep({ root }, adapters);
			const state = await loadRalphState(root);
			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;
			const progress = await loadRalphProgressEntries(root);
			const activeStory = prd.userStories.find(
				(story) => story.id === "US-001",
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(state?.currentStoryId).toBe("US-001");
			expect(state?.status).toBe("running");
			expect(activeStory?.state).toBe("peer_review_1");
			expect(progress).toHaveLength(1);
			expect(progress[0]?.status).toBe("reviewing");
			expect(calls).toEqual([
				expect.stringContaining("goal:"),
				"worker:US-001:openai:gpt-5-codex:8:true",
				"workflow",
				"ci",
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("fails cleanly when the worker times out", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-timeout",
				branchName: "feature/ralph-timeout",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async () => {},
					runWorker: async () => {
						throw new Error("Worker timeout after 300000ms");
					},
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			const state = await loadRalphState(root);
			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;
			const activeStory = prd.userStories.find(
				(story) => story.id === "US-001",
			);
			const progress = await loadRalphProgressEntries(root);

			expect(result.ok).toBe(false);
			expect(result.storyId).toBe("US-001");
			expect(result.reason).toContain("timeout");
			expect(state?.status).toBe("blocked");
			expect(activeStory?.state).toBe("failed");
			expect(progress[0]?.status).toBe("failed");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
