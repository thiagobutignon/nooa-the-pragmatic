import { readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { execa } from "execa";
import { setGoal } from "../goal/execute";
import {
	loadRalphPrd,
	type RalphPrd,
	type RalphStory,
	saveRalphPrd,
} from "./prd";
import { appendRalphProgressEntry, type RalphProgressEntry } from "./progress";
import {
	acquireRalphStateLock,
	assertDistinctRalphReviewerIdentity,
	createDefaultRalphState,
	loadRalphState,
	type RalphState,
	releaseRalphStateLock,
	saveRalphState,
	transitionRalphStoryState,
} from "./state";

const SAFE_IGNORE_PATTERNS = [".nooa/ralph/", ".nooa/ralph", ".nooa/", ".nooa"];

export interface RalphInitInput {
	root?: string;
	runId?: string;
	branchName?: string;
	workerProvider?: string;
	workerModel?: string;
	reviewerProvider?: string;
	reviewerModel?: string;
	workerTimeoutMs?: number;
	reviewerTimeoutMs?: number;
	strictReviewerIdentity?: boolean;
}

export interface RalphInitResult {
	mode: "init";
	initialized: true;
	runId: string;
	branchName: string;
	ignoredBy: string;
	statePath: string;
	prdPath: string;
	status: RalphState["status"];
}

export interface RalphStatusResult {
	mode: "status";
	initialized: boolean;
	runId: string | null;
	branchName: string | null;
	status: RalphState["status"] | "idle";
	currentStoryId: string | null;
	storyCounts: {
		total: number;
		pending: number;
		passed: number;
		blocked: number;
	};
}

export interface RalphImportPrdResult {
	mode: "import-prd";
	path: string;
	storyCount: number;
}

export interface RalphSelectStoryResult {
	mode: "select-story";
	story: RalphStory | null;
}

export interface RalphStepResult {
	mode: "step";
	ok: boolean;
	storyId: string | null;
	state: RalphStory["state"] | null;
	reason?: string;
}

export interface RalphWorkerInvocation {
	root: string;
	goal: string;
	story: RalphStory;
	provider: string | null;
	model: string | null;
	turns: number;
	headless: true;
	timeoutMs: number | null;
}

export interface RalphStepAdapters {
	setGoal: (goal: string, cwd: string) => Promise<void>;
	runWorker: (
		input: RalphWorkerInvocation,
	) => Promise<{ ok: boolean; finalAnswer?: string }>;
	runWorkflow: (input: {
		root: string;
		target: string;
	}) => Promise<{ ok: boolean; reason?: string }>;
	runCi: (input: { root: string }) => Promise<{ ok: boolean; reason?: string }>;
	appendProgress: (
		root: string,
		entry: RalphProgressEntry,
	) => Promise<RalphProgressEntry>;
}

const DEFAULT_RALPH_STEP_ADAPTERS: RalphStepAdapters = {
	setGoal,
	runWorker: async (input) => {
		const args = [
			"run",
			"index.ts",
			"act",
			input.goal,
			"--json",
			"--skip-verification",
			"--turns",
			String(input.turns),
		];

		if (input.provider) {
			args.push("--provider", input.provider);
		}
		if (input.model) {
			args.push("--model", input.model);
		}

		const result = await execa(process.execPath, args, {
			cwd: input.root,
			reject: false,
			timeout: input.timeoutMs ?? undefined,
			env: {
				...process.env,
				NOOA_DISABLE_REFLECTION: "1",
			},
		});

		if (result.exitCode !== 0) {
			const reason =
				result.stderr || result.stdout || "Worker execution failed";
			throw new Error(reason);
		}

		const parsed = JSON.parse(result.stdout) as {
			ok: boolean;
			finalAnswer?: string;
		};
		return parsed;
	},
	runWorkflow: async (input) => {
		const result = await execa(
			process.execPath,
			[
				"run",
				"index.ts",
				"workflow",
				"run",
				"--json",
				"--target",
				input.target,
			],
			{
				cwd: input.root,
				reject: false,
				env: {
					...process.env,
					NOOA_DISABLE_REFLECTION: "1",
				},
			},
		);

		if (result.exitCode !== 0) {
			return { ok: false, reason: result.stderr || result.stdout };
		}

		const parsed = JSON.parse(result.stdout) as {
			ok: boolean;
			reason?: string;
		};
		return parsed;
	},
	runCi: async (input) => {
		const result = await execa(
			process.execPath,
			["run", "index.ts", "ci", "--json"],
			{
				cwd: input.root,
				reject: false,
				env: {
					...process.env,
					NOOA_DISABLE_REFLECTION: "1",
				},
			},
		);

		if (result.exitCode !== 0) {
			return { ok: false, reason: result.stderr || result.stdout };
		}

		const parsed = JSON.parse(result.stdout) as {
			ok: boolean;
		};
		return { ok: parsed.ok, reason: parsed.ok ? undefined : "CI failed" };
	},
	appendProgress: appendRalphProgressEntry,
};

async function detectBranchName(root: string): Promise<string> {
	const result = await execa("git", ["branch", "--show-current"], {
		cwd: root,
		reject: false,
	});
	return result.exitCode === 0 && result.stdout.trim()
		? result.stdout.trim()
		: "main";
}

async function findIgnoreRule(root: string): Promise<string | null> {
	try {
		const raw = await readFile(join(root, ".gitignore"), "utf-8");
		const lines = raw
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		return (
			SAFE_IGNORE_PATTERNS.find((pattern) => lines.includes(pattern)) ?? null
		);
	} catch {
		return null;
	}
}

function buildDefaultPrd(root: string, branchName: string): RalphPrd {
	return {
		project: basename(root),
		branchName,
		description: `Ralph backlog for ${branchName}`,
		userStories: [],
	};
}

function countStories(prd: RalphPrd | null) {
	const stories = prd?.userStories ?? [];
	return {
		total: stories.length,
		pending: stories.filter((story) => !story.passes).length,
		passed: stories.filter((story) => story.passes).length,
		blocked: stories.filter((story) => story.state === "blocked").length,
	};
}

export async function initializeRalphRun(
	input: RalphInitInput,
): Promise<RalphInitResult> {
	const root = input.root ?? process.cwd();
	const ignoredBy = await findIgnoreRule(root);
	if (!ignoredBy) {
		throw new Error(".nooa/ralph/ must be git-ignored before init");
	}

	const branchName = input.branchName ?? (await detectBranchName(root));
	const runId =
		input.runId ??
		`ralph-${branchName.replaceAll(/[^\w-]+/g, "-")}-${Date.now()}`;
	const state = createDefaultRalphState({
		runId,
		branchName,
		workerProvider: input.workerProvider,
		workerModel: input.workerModel,
		reviewerProvider: input.reviewerProvider,
		reviewerModel: input.reviewerModel,
		workerTimeoutMs: input.workerTimeoutMs,
		reviewerTimeoutMs: input.reviewerTimeoutMs,
	});
	assertDistinctRalphReviewerIdentity(state, {
		strict: input.strictReviewerIdentity ?? false,
	});

	await releaseRalphStateLock(root);
	await saveRalphState(root, state);

	try {
		await loadRalphPrd(root);
	} catch {
		await saveRalphPrd(root, buildDefaultPrd(root, branchName));
	}

	return {
		mode: "init",
		initialized: true,
		runId,
		branchName,
		ignoredBy,
		statePath: join(root, ".nooa", "ralph", "state.json"),
		prdPath: join(root, ".nooa", "ralph", "prd.json"),
		status: state.status,
	};
}

export async function getRalphStatus(input?: {
	root?: string;
}): Promise<RalphStatusResult> {
	const root = input?.root ?? process.cwd();
	const state = await loadRalphState(root);
	if (!state) {
		return {
			mode: "status",
			initialized: false,
			runId: null,
			branchName: null,
			status: "idle",
			currentStoryId: null,
			storyCounts: {
				total: 0,
				pending: 0,
				passed: 0,
				blocked: 0,
			},
		};
	}

	let prd: RalphPrd | null = null;
	try {
		prd = await loadRalphPrd(root);
	} catch {
		prd = null;
	}

	return {
		mode: "status",
		initialized: true,
		runId: state.runId,
		branchName: state.branchName,
		status: state.status,
		currentStoryId: state.currentStoryId,
		storyCounts: countStories(prd),
	};
}

export async function importRalphPrdFile(input: {
	root?: string;
	path: string;
}): Promise<RalphImportPrdResult> {
	const root = input.root ?? process.cwd();
	const raw = await readFile(input.path, "utf-8");
	const prd = JSON.parse(raw) as RalphPrd;
	await saveRalphPrd(root, prd);
	return {
		mode: "import-prd",
		path: input.path,
		storyCount: prd.userStories.length,
	};
}

export async function selectNextRalphStory(input?: {
	root?: string;
}): Promise<RalphSelectStoryResult> {
	const root = input?.root ?? process.cwd();
	const prd = await loadRalphPrd(root);
	const story =
		[...prd.userStories]
			.filter((candidate) => !candidate.passes && candidate.state !== "blocked")
			.sort((left, right) => left.priority - right.priority)[0] ?? null;
	return {
		mode: "select-story",
		story,
	};
}

function buildRalphStoryGoal(story: RalphStory): string {
	return `Implement story ${story.id}: ${story.title}

${story.description}

Acceptance criteria:
${story.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`;
}

export async function executeRalphStep(
	input?: {
		root?: string;
	},
	adapters: RalphStepAdapters = DEFAULT_RALPH_STEP_ADAPTERS,
): Promise<RalphStepResult> {
	const root = input?.root ?? process.cwd();
	const state = await loadRalphState(root);
	if (!state) {
		return {
			mode: "step",
			ok: false,
			storyId: null,
			state: null,
			reason: "No active Ralph run in this workspace",
		};
	}

	const prd = await loadRalphPrd(root);
	const story =
		[...prd.userStories]
			.filter((candidate) => !candidate.passes && candidate.state !== "blocked")
			.sort((left, right) => left.priority - right.priority)[0] ?? null;

	if (!story) {
		return {
			mode: "step",
			ok: false,
			storyId: null,
			state: null,
			reason: "No pending Ralph stories available",
		};
	}

	await acquireRalphStateLock(root, `ralph-step:${process.pid}`);

	try {
		state.currentStoryId = story.id;
		state.status = "running";
		await saveRalphState(root, state);

		const storyIndex = prd.userStories.findIndex(
			(candidate) => candidate.id === story.id,
		);
		if (storyIndex === -1) {
			throw new Error(`Unable to locate story ${story.id} in PRD`);
		}

		let activeStory = transitionRalphStoryState(
			{
				...prd.userStories[storyIndex],
				state: prd.userStories[storyIndex]?.state ?? "pending",
			},
			"implementing",
		);
		prd.userStories[storyIndex] = activeStory;
		await saveRalphPrd(root, prd);

		const goal = buildRalphStoryGoal(activeStory);
		await adapters.setGoal(goal, root);

		try {
			const workerResult = await adapters.runWorker({
				root,
				goal,
				story: activeStory,
				provider: state.worker.provider,
				model: state.worker.model,
				turns: 8,
				headless: true,
				timeoutMs: state.timeouts.workerMs,
			});

			if (!workerResult.ok) {
				throw new Error(workerResult.finalAnswer || "Worker execution failed");
			}
		} catch (error) {
			activeStory = { ...activeStory, state: "failed" };
			prd.userStories[storyIndex] = activeStory;
			state.status = "blocked";
			await saveRalphPrd(root, prd);
			await saveRalphState(root, state);
			const message = error instanceof Error ? error.message : String(error);
			await adapters.appendProgress(root, {
				runId: state.runId,
				storyId: activeStory.id,
				iteration: 1,
				status: "failed",
				notes: [message],
			});
			return {
				mode: "step",
				ok: false,
				storyId: activeStory.id,
				state: activeStory.state,
				reason: message,
			};
		}

		activeStory = transitionRalphStoryState(activeStory, "verifying");
		prd.userStories[storyIndex] = activeStory;
		await saveRalphPrd(root, prd);

		const workflowResult = await adapters.runWorkflow({
			root,
			target: activeStory.id,
		});
		if (!workflowResult.ok) {
			throw new Error(workflowResult.reason || "Workflow verification failed");
		}

		const ciResult = await adapters.runCi({ root });
		if (!ciResult.ok) {
			throw new Error(ciResult.reason || "CI verification failed");
		}

		activeStory = transitionRalphStoryState(activeStory, "peer_review_1");
		prd.userStories[storyIndex] = activeStory;
		await saveRalphPrd(root, prd);

		await adapters.appendProgress(root, {
			runId: state.runId,
			storyId: activeStory.id,
			iteration: 1,
			status: "reviewing",
			gates: {
				workflow: true,
				ci: true,
			},
			notes: ["Story executed and moved into peer review."],
		});

		return {
			mode: "step",
			ok: true,
			storyId: activeStory.id,
			state: activeStory.state,
		};
	} finally {
		await releaseRalphStateLock(root);
	}
}

export async function resetRalphLock(root: string = process.cwd()) {
	await rm(join(root, ".nooa", "ralph", "state.lock"), { force: true });
}
