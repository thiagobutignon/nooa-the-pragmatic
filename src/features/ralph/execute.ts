import { readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { execa } from "execa";
import {
	loadRalphPrd,
	type RalphPrd,
	type RalphStory,
	saveRalphPrd,
} from "./prd";
import {
	createDefaultRalphState,
	loadRalphState,
	type RalphState,
	releaseRalphStateLock,
	saveRalphState,
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

export async function resetRalphLock(root: string = process.cwd()) {
	await rm(join(root, ".nooa", "ralph", "state.lock"), { force: true });
}
