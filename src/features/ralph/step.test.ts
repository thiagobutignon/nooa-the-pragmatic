import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

function captureSequence(...snapshots: string[][]) {
	let index = 0;
	return async () => snapshots[Math.min(index++, snapshots.length - 1)] ?? [];
}

describe("ralph step", () => {
	test("returns a clear no-run result when Ralph is not initialized", async () => {
		const root = await createTempRepo();

		try {
			const result = await executeRalphStep({ root });
			expect(result.ok).toBe(false);
			expect(result.storyId).toBeNull();
			expect(result.reason).toContain("No active Ralph run");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("returns a clear result when no pending stories are available", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-no-pending",
				branchName: "feature/ralph-no-pending",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPrd(),
				userStories: [],
			});

			const result = await executeRalphStep({ root });
			expect(result.ok).toBe(false);
			expect(result.storyId).toBeNull();
			expect(result.reason).toContain("No pending Ralph stories");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

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
				captureWorkspaceFiles: captureSequence(
					[],
					["demo/index.html", "demo/styles.css"],
				),
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
				runCi: async (input) => {
					calls.push(`ci:${input.files.join(",")}`);
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
				"ci:demo/index.html,demo/styles.css",
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("prioritizes retrying a failed story before taking a new pending story", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-retry-priority",
				branchName: "feature/ralph-retry-priority",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPrd(),
				userStories: [
					{
						id: "US-001",
						title: "Highest priority pending",
						description: "Fresh story",
						acceptanceCriteria: ["passes"],
						priority: 1,
						passes: false,
						notes: "",
						state: "pending",
					},
					{
						id: "US-002",
						title: "Lower priority failed",
						description: "Retry me first",
						acceptanceCriteria: ["passes"],
						priority: 2,
						passes: false,
						notes: "Previous failure context",
						state: "failed",
					},
				],
			});

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async (goal) => {
						calls.push(goal);
					},
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
					runWorker: async (input) => {
						calls.push(`worker:${input.story.id}`);
						return { ok: true, finalAnswer: "implemented" };
					},
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-002");
			expect(calls[0]).toContain("Implement story US-002");
			expect(calls[1]).toBe("worker:US-002");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("resumes a story already in verifying without re-running implementation", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-resume-verifying",
				branchName: "feature/ralph-resume-verifying",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPrd(),
				userStories: [
					{
						id: "US-001",
						title: "Highest priority",
						description: "First story",
						acceptanceCriteria: ["demo/index.html must exist"],
						priority: 1,
						passes: false,
						notes: "",
						state: "verifying",
					},
				],
			});
			await mkdir(join(root, "demo"), { recursive: true });
			await writeFile(join(root, "demo", "index.html"), "<html></html>");

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async () => {
						calls.push("goal");
					},
					captureWorkspaceFiles: captureSequence(["demo/index.html"]),
					runWorker: async () => {
						calls.push("worker");
						return { ok: true, finalAnswer: "implemented" };
					},
					runWorkflow: async () => {
						calls.push("workflow");
						return { ok: true };
					},
					runCi: async (input) => {
						calls.push(`ci:${input.files.join(",")}`);
						return { ok: true };
					},
					appendProgress: appendRalphProgressEntry,
				},
			);

			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;
			const activeStory = prd.userStories.find(
				(story) => story.id === "US-001",
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(activeStory?.state).toBe("peer_review_1");
			expect(calls).toEqual(["workflow", "ci:demo/index.html"]);
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
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
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

	test("continues when worker hits max turns but produced implementation evidence", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-soft-worker-fail",
				branchName: "feature/ralph-soft-worker-fail",
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
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
					runWorker: async () => {
						throw new Error("Goal not achieved after 8 turns.");
					},
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(result.state).toBe("peer_review_1");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("continues when worker returns generic failure but produced implementation evidence", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-soft-generic-fail",
				branchName: "feature/ralph-soft-generic-fail",
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
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
					runWorker: async () => ({ ok: false, finalAnswer: undefined }),
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(result.state).toBe("peer_review_1");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("fails when recoverable worker failure has no changed files in this step", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-soft-no-delta",
				branchName: "feature/ralph-soft-no-delta",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());
			await mkdir(join(root, "demo"), { recursive: true });
			await writeFile(join(root, "demo", "index.html"), "<html></html>");

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async () => {},
					captureWorkspaceFiles: captureSequence([], []),
					runWorker: async () => {
						throw new Error("Goal not achieved after 8 turns.");
					},
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(false);
			expect(result.reason).toContain("No implementation evidence");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("fails when workflow verification rejects the story", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-workflow-fail",
				branchName: "feature/ralph-workflow-fail",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			await expect(
				executeRalphStep(
					{ root },
					{
						setGoal: async () => {},
						captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
						runWorker: async () => ({ ok: true, finalAnswer: "implemented" }),
						runWorkflow: async () => ({
							ok: false,
							reason: "workflow gates failed",
						}),
						runCi: async () => ({ ok: true }),
						appendProgress: appendRalphProgressEntry,
					},
				),
			).rejects.toThrow("workflow gates failed");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("fails when CI verification rejects the story", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-ci-fail",
				branchName: "feature/ralph-ci-fail",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			await expect(
				executeRalphStep(
					{ root },
					{
						setGoal: async () => {},
						captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
						runWorker: async () => ({ ok: true, finalAnswer: "implemented" }),
						runWorkflow: async () => ({ ok: true }),
						runCi: async () => ({
							ok: false,
							reason: "ci checks failed",
						}),
						appendProgress: appendRalphProgressEntry,
					},
				),
			).rejects.toThrow("ci checks failed");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("records inspect-test-failure evidence when CI rejects changed test files", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-ci-inspect-fail",
				branchName: "feature/ralph-ci-inspect-fail",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, createPrd());

			await expect(
				executeRalphStep(
					{ root },
					{
						setGoal: async () => {},
						captureWorkspaceFiles: captureSequence([], ["demo/failing.test.ts"]),
						runWorker: async () => ({ ok: true, finalAnswer: "implemented" }),
						runWorkflow: async () => ({ ok: true }),
						runCi: async () => ({
							ok: false,
							reason: "ci checks failed",
						}),
						inspectTestFailure: async () => ({
							mode: "inspect-test-failure",
							state: "failed",
							stack: [
								{
									ref: "@f0",
									name: "(test failure)",
									file: "/tmp/demo/failing.test.ts",
									line: 7,
									column: 3,
								},
							],
							exception: {
								reason: "test_failure",
								message: "error: expect(received).toBe(expected)",
							},
							source: ["test('fails', () => {", "\texpect(1).toBe(2);", "});"],
						}),
						appendProgress: appendRalphProgressEntry,
					},
				),
			).rejects.toThrow("ci checks failed");

			const state = await loadRalphState(root);
			const prd = JSON.parse(
				await readFile(join(root, ".nooa", "ralph", "prd.json"), "utf-8"),
			) as RalphPrd;
			const progress = await loadRalphProgressEntries(root);
			const activeStory = prd.userStories.find((story) => story.id === "US-001");
			const failedEntry = progress.at(-1);

			expect(state?.status).toBe("blocked");
			expect(activeStory?.state).toBe("failed");
			expect(activeStory?.notes).toContain(
				"Test failure: error: expect(received).toBe(expected)",
			);
			expect(activeStory?.notes).toContain(
				"Failure location: /tmp/demo/failing.test.ts:7:3",
			);
			expect(failedEntry?.status).toBe("failed");
			expect(failedEntry?.notes).toContain("CI verification failed.");
			expect(failedEntry?.notes).toContain("ci checks failed");
			expect(failedEntry?.notes).toContain(
				"Test failure: error: expect(received).toBe(expected)",
			);
			expect(failedEntry?.notes).toContain(
				"Failure location: /tmp/demo/failing.test.ts:7:3",
			);
			expect(failedEntry?.investigation).toEqual({
				kind: "test_failure",
				reason: "test_failure",
				message: "error: expect(received).toBe(expected)",
				location: {
					file: "/tmp/demo/failing.test.ts",
					line: 7,
					column: 3,
				},
				source: ["test('fails', () => {", "\texpect(1).toBe(2);", "});"],
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("includes failed-story investigation notes in the next worker goal", async () => {
		const root = await createTempRepo();
		const goals: string[] = [];
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-retry-with-notes",
				branchName: "feature/ralph-retry-with-notes",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPrd(),
				userStories: [
					{
						id: "US-001",
						title: "Highest priority",
						description: "First story",
						acceptanceCriteria: ["passes"],
						priority: 1,
						passes: false,
						notes: [
							"CI verification failed.",
							"Test failure: error: expect(received).toBe(expected)",
							"Failure location: /tmp/demo/failing.test.ts:7:3",
						].join("\n"),
						state: "failed",
					},
				],
			});

			await executeRalphStep(
				{ root },
				{
					setGoal: async (goal) => {
						goals.push(goal);
					},
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
					runWorker: async () => ({ ok: true, finalAnswer: "implemented" }),
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(goals[0]).toContain("Known failure context:");
			expect(goals[0]).toContain(
				"Test failure: error: expect(received).toBe(expected)",
			);
			expect(goals[0]).toContain(
				"Failure location: /tmp/demo/failing.test.ts:7:3",
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("captures profile investigation for performance stories after verification succeeds", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-profile-investigation",
				branchName: "feature/ralph-profile-investigation",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPrd(),
				userStories: [
					{
						id: "US-001",
						title: "Improve performance",
						description: "Reduce CPU hotspots in the flow",
						acceptanceCriteria: ["performance profile stays healthy"],
						priority: 1,
						passes: false,
						notes: "",
						state: "pending",
					},
				],
			});

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async () => {},
					captureWorkspaceFiles: captureSequence([], ["demo/failing.test.ts"]),
					runWorker: async () => ({ ok: true, finalAnswer: "implemented" }),
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					inspectProfile: async () => ({
						kind: "profile_hotspots",
						runtime: "node",
						duration_ms: 67,
						hotspots: [
							{
								function: "busySpin",
								url: "/tmp/cpu-busy.js",
								line: 1,
								column: 1,
								self_ms: 8,
								samples: 2,
							},
						],
					}),
					appendProgress: appendRalphProgressEntry,
				},
			);

			const progress = await loadRalphProgressEntries(root);
			const reviewingEntry = progress.at(-1);

			expect(result.ok).toBe(true);
			expect(reviewingEntry?.status).toBe("reviewing");
			expect(reviewingEntry?.investigation).toEqual({
				kind: "profile_hotspots",
				runtime: "node",
				duration_ms: 67,
				hotspots: [
					{
						function: "busySpin",
						url: "/tmp/cpu-busy.js",
						line: 1,
						column: 1,
						self_ms: 8,
						samples: 2,
					},
				],
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("fails when the worker produces no relevant implementation evidence", async () => {
		const root = await createTempRepo();
		try {
			await initializeRalphRun({
				root,
				runId: "ralph-no-evidence",
				branchName: "feature/ralph-no-evidence",
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
					captureWorkspaceFiles: async () => [],
					runWorker: async () => ({ ok: true, finalAnswer: "implemented" }),
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			const state = await loadRalphState(root);
			expect(result.ok).toBe(false);
			expect(result.reason).toContain("No implementation evidence");
			expect(state?.status).toBe("blocked");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("re-runs worker when verifying story has no evidence yet", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-verifying-rerun",
				branchName: "feature/ralph-verifying-rerun",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				...createPrd(),
				userStories: [
					{
						id: "US-001",
						title: "Highest priority",
						description: "First story",
						acceptanceCriteria: ["index.html must exist"],
						priority: 1,
						passes: false,
						notes: "",
						state: "verifying",
					},
				],
			});

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async () => {
						calls.push("goal");
					},
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
					runWorker: async () => {
						calls.push("worker");
						return { ok: true, finalAnswer: "implemented" };
					},
					runWorkflow: async () => {
						calls.push("workflow");
						return { ok: true };
					},
					runCi: async (input) => {
						calls.push(`ci:${input.files.join(",")}`);
						return { ok: true };
					},
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.storyId).toBe("US-001");
			expect(calls).toEqual([
				"goal",
				"worker",
				"workflow",
				"ci:demo/index.html",
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("uses NOOA_WORKER_TURNS when configured", async () => {
		const root = await createTempRepo();
		const calls: string[] = [];
		const previousTurns = process.env.NOOA_WORKER_TURNS;
		process.env.NOOA_WORKER_TURNS = "16";

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-worker-turns",
				branchName: "feature/ralph-worker-turns",
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
					captureWorkspaceFiles: captureSequence([], ["demo/index.html"]),
					runWorker: async (input) => {
						calls.push(`turns:${input.turns}`);
						return { ok: true, finalAnswer: "implemented" };
					},
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(calls).toEqual(["turns:16"]);
		} finally {
			if (previousTurns === undefined) {
				delete process.env.NOOA_WORKER_TURNS;
			} else {
				process.env.NOOA_WORKER_TURNS = previousTurns;
			}
			await rm(root, { recursive: true, force: true });
		}
	});

	test("detects evidence when worker edits the same tracked story file path", async () => {
		const root = await createTempRepo();

		try {
			await initializeRalphRun({
				root,
				runId: "ralph-same-path-edit",
				branchName: "feature/ralph-same-path-edit",
				workerProvider: "openai",
				workerModel: "gpt-5-codex",
				reviewerProvider: "anthropic",
				reviewerModel: "claude-3.7",
			});
			await saveRalphPrd(root, {
				project: "NOOA",
				branchName: "feature/ralph-step",
				description: "Ralph step fixture",
				userStories: [
					{
						id: "US-001",
						title: "Story",
						description: "Updates demo file",
						acceptanceCriteria: ["Update demo/index.html"],
						priority: 1,
						passes: false,
						notes: "",
						state: "pending",
					},
				],
			});
			await mkdir(join(root, "demo"), { recursive: true });
			await writeFile(join(root, "demo", "index.html"), "<p>before</p>");

			const result = await executeRalphStep(
				{ root },
				{
					setGoal: async () => {},
					captureWorkspaceFiles: captureSequence(["demo/index.html"], [
						"demo/index.html",
					]),
					runWorker: async () => {
						await writeFile(join(root, "demo", "index.html"), "<p>after</p>");
						return { ok: false, finalAnswer: "Goal not achieved after 8 turns." };
					},
					runWorkflow: async () => ({ ok: true }),
					runCi: async () => ({ ok: true }),
					appendProgress: appendRalphProgressEntry,
				},
			);

			expect(result.ok).toBe(true);
			expect(result.state).toBe("peer_review_1");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
