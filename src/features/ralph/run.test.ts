import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	executeRalphRun,
	initializeRalphRun,
	type RalphRunLoopAdapters,
} from "./execute";
import { getRalphPrdPath, type RalphPrd, saveRalphPrd } from "./prd";

async function createTempRepo() {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-run-"));
	await writeFile(join(root, ".gitignore"), ".nooa/ralph/\n");
	return root;
}

function createPrd(stories?: RalphPrd["userStories"]): RalphPrd {
	return {
		project: "NOOA",
		branchName: "feature/ralph-run",
		description: "Ralph run fixture",
		userStories: stories ?? [
			{
				id: "US-001",
				title: "Story one",
				description: "One",
				acceptanceCriteria: ["done"],
				priority: 1,
				passes: false,
				notes: "",
				state: "pending",
			},
			{
				id: "US-002",
				title: "Story two",
				description: "Two",
				acceptanceCriteria: ["done"],
				priority: 2,
				passes: false,
				notes: "",
				state: "pending",
			},
		],
	};
}

describe("ralph run", () => {
	test("returns a clear no-run result when Ralph is not initialized", async () => {
		const root = await createTempRepo();

		try {
			const result = await executeRalphRun({ root });
			expect(result.ok).toBe(false);
			expect(result.iterations).toBe(0);
			expect(result.reason).toContain("No active Ralph run");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("fails clearly when the run state exists but no PRD is loaded", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-no-prd",
				branchName: "feature/ralph-no-prd",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await rm(getRalphPrdPath(root), { force: true });

			const result = await executeRalphRun({ root });
			expect(result.ok).toBe(false);
			expect(result.reason).toContain("No Ralph PRD loaded");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("returns success immediately when the backlog is already complete", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-complete",
				branchName: "feature/ralph-complete",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(
				root,
				createPrd([
					{
						id: "US-001",
						title: "Done story",
						description: "Done",
						acceptanceCriteria: ["done"],
						priority: 1,
						passes: true,
						notes: "",
						state: "passed",
					},
				]),
			);

			const result = await executeRalphRun({ root, maxIterations: 3 });
			expect(result.ok).toBe(true);
			expect(result.iterations).toBe(0);
			expect(result.completedStories).toBe(1);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("repeatedly invokes fresh step and stops when all stories pass", async () => {
		const root = await createTempRepo();
		let iteration = 0;
		const calls: string[] = [];

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-run",
				branchName: "feature/ralph-run",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			const adapters: RalphRunLoopAdapters = {
				runStepProcess: async ({ root: cwd, iteration: currentIteration }) => {
					calls.push(`step:${cwd}:${currentIteration}`);
					iteration += 1;
					const prd = createPrd(
						iteration === 1
							? [
									{
										id: "US-001",
										title: "Story one",
										description: "One",
										acceptanceCriteria: ["done"],
										priority: 1,
										passes: true,
										notes: "",
										state: "passed",
									},
									{
										id: "US-002",
										title: "Story two",
										description: "Two",
										acceptanceCriteria: ["done"],
										priority: 2,
										passes: false,
										notes: "",
										state: "pending",
									},
								]
							: [
									{
										id: "US-001",
										title: "Story one",
										description: "One",
										acceptanceCriteria: ["done"],
										priority: 1,
										passes: true,
										notes: "",
										state: "passed",
									},
									{
										id: "US-002",
										title: "Story two",
										description: "Two",
										acceptanceCriteria: ["done"],
										priority: 2,
										passes: true,
										notes: "",
										state: "passed",
									},
								],
					);
					await saveRalphPrd(root, prd);
					return { ok: true, storyId: `US-00${iteration}` };
				},
			};

			const result = await executeRalphRun(
				{ root, maxIterations: 5, blockedThreshold: 1 },
				adapters,
			);

			expect(result.ok).toBe(true);
			expect(result.completedStories).toBe(2);
			expect(result.iterations).toBe(2);
			expect(calls).toEqual([`step:${root}:1`, `step:${root}:2`]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("stops when blocked story threshold is reached", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-blocked",
				branchName: "feature/ralph-blocked",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(
				root,
				createPrd([
					{
						id: "US-001",
						title: "Blocked story",
						description: "Blocked",
						acceptanceCriteria: ["done"],
						priority: 1,
						passes: false,
						notes: "",
						state: "pending",
					},
				]),
			);

			const result = await executeRalphRun(
				{ root, maxIterations: 5, blockedThreshold: 1 },
				{
					runStepProcess: async () => {
						await saveRalphPrd(
							root,
							createPrd([
								{
									id: "US-001",
									title: "Blocked story",
									description: "Blocked",
									acceptanceCriteria: ["done"],
									priority: 1,
									passes: false,
									notes: "",
									state: "blocked",
								},
							]),
						);
						return { ok: false, reason: "blocked by reviewer" };
					},
				},
			);

			expect(result.ok).toBe(false);
			expect(result.blockedStories).toBe(1);
			expect(result.reason).toContain("Blocked story threshold");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("stops at max iterations when stories never finish", async () => {
		const root = await createTempRepo();
		let calls = 0;

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-max",
				branchName: "feature/ralph-max",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			const result = await executeRalphRun(
				{ root, maxIterations: 2, blockedThreshold: 2 },
				{
					runStepProcess: async () => {
						calls += 1;
						return { ok: true, storyId: "US-001" };
					},
				},
			);

			expect(result.ok).toBe(false);
			expect(result.iterations).toBe(2);
			expect(calls).toBe(2);
			expect(result.reason).toContain("Max iterations");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("reloads state from disk between iterations instead of trusting memory", async () => {
		const root = await createTempRepo();
		let calls = 0;

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-reload",
				branchName: "feature/ralph-reload",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			const result = await executeRalphRun(
				{ root, maxIterations: 3, blockedThreshold: 1 },
				{
					runStepProcess: async () => {
						calls += 1;
						if (calls === 1) {
							await saveRalphPrd(
								root,
								createPrd([
									{
										id: "US-001",
										title: "Story one",
										description: "One",
										acceptanceCriteria: ["done"],
										priority: 1,
										passes: true,
										notes: "",
										state: "passed",
									},
								]),
							);
						}
						return { ok: true };
					},
				},
			);

			expect(result.ok).toBe(true);
			expect(result.completedStories).toBe(1);
			expect(calls).toBe(1);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("processes peer review stories before opening a new step", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-review-first",
				branchName: "feature/ralph-review-first",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(
				root,
				createPrd([
					{
						id: "US-001",
						title: "Story one",
						description: "One",
						acceptanceCriteria: ["done"],
						priority: 1,
						passes: false,
						notes: "",
						state: "peer_review_1",
					},
					{
						id: "US-002",
						title: "Story two",
						description: "Two",
						acceptanceCriteria: ["done"],
						priority: 2,
						passes: false,
						notes: "",
						state: "pending",
					},
				]),
			);

			const result = await executeRalphRun(
				{ root, maxIterations: 3, blockedThreshold: 1 },
				{
					runStepProcess: async ({ iteration }) => {
						calls.push(`step:${iteration}`);
						await saveRalphPrd(
							root,
							createPrd([
								{
									id: "US-001",
									title: "Story one",
									description: "One",
									acceptanceCriteria: ["done"],
									priority: 1,
									passes: true,
									notes: "",
									state: "passed",
								},
								{
									id: "US-002",
									title: "Story two",
									description: "Two",
									acceptanceCriteria: ["done"],
									priority: 2,
									passes: true,
									notes: "",
									state: "passed",
								},
							]),
						);
						return { ok: true };
					},
					runReviewProcess: async ({ storyId, iteration }) => {
						calls.push(`review:${iteration}:${storyId}`);
						await saveRalphPrd(
							root,
							createPrd([
								{
									id: "US-001",
									title: "Story one",
									description: "One",
									acceptanceCriteria: ["done"],
									priority: 1,
									passes: true,
									notes: "",
									state: "passed",
								},
								{
									id: "US-002",
									title: "Story two",
									description: "Two",
									acceptanceCriteria: ["done"],
									priority: 2,
									passes: false,
									notes: "",
									state: "pending",
								},
							]),
						);
						return {
							ok: true,
							storyId,
							state: "passed",
							rounds: 1,
						};
					},
				},
			);

			expect(result.ok).toBe(true);
			expect(result.completedStories).toBe(2);
			expect(calls).toEqual(["review:1:US-001", "step:2"]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("parent process enforces global step timeout policy", async () => {
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

			const result = await executeRalphRun(
				{ root, maxIterations: 1, stepTimeoutMs: 1000, blockedThreshold: 1 },
				{
					runStepProcess: async () => {
						throw new Error("Step timeout after 1000ms");
					},
				},
			);

			expect(result.ok).toBe(false);
			expect(result.reason).toContain("timeout");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
