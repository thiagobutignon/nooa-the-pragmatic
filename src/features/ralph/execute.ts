import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { execa } from "execa";
import { PolicyEngine } from "../../core/policy/PolicyEngine";
import { setGoal } from "../goal/execute";
import { buildRalphLearningCandidate } from "./learnings";
import {
	loadRalphPrd,
	type RalphPrd,
	type RalphStory,
	saveRalphPrd,
} from "./prd";
import {
	appendRalphProgressEntry,
	loadRalphProgressEntries,
	type RalphProgressInvestigation,
	type RalphProgressEntry,
} from "./progress";
import {
	acquireRalphStateLock,
	assertDistinctRalphReviewerIdentity,
	createDefaultRalphState,
	loadRalphState,
	markRalphStoryApproved,
	type RalphState,
	recordRalphPeerReview,
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
	captureWorkspaceFiles: (root: string) => Promise<string[]>;
	runWorker: (
		input: RalphWorkerInvocation,
	) => Promise<{ ok: boolean; finalAnswer?: string }>;
	runWorkflow: (input: {
		root: string;
		target: string;
	}) => Promise<{ ok: boolean; reason?: string }>;
	runCi: (input: {
		root: string;
		files: string[];
	}) => Promise<{ ok: boolean; reason?: string }>;
	inspectTestFailure?: (input: {
		root: string;
		command: string[];
	}) => Promise<{
		mode: "inspect-test-failure";
		state?: string;
		source?: string[];
		stack?: Array<{ file: string; line: number; column?: number }>;
		exception?: { reason?: string; message?: string };
	}>;
	inspectProfile?: (input: {
		root: string;
		command: string[];
	}) => Promise<RalphProgressInvestigation>;
	appendProgress: (
		root: string,
		entry: RalphProgressEntry,
	) => Promise<RalphProgressEntry>;
}

export interface RalphReviewInvocation {
	root: string;
	story: RalphStory;
	provider: string | null;
	model: string | null;
	temperature: number;
	timeoutMs: number | null;
}

export interface RalphReviewLoopAdapters {
	setGoal: (goal: string, cwd: string) => Promise<void>;
	runWorker: (
		input: RalphWorkerInvocation,
	) => Promise<{ ok: boolean; finalAnswer?: string }>;
	runReview: (input: RalphReviewInvocation) => Promise<{
		ok: boolean;
		findings: Array<{ severity: string; message: string }>;
		summary?: string;
	}>;
	appendProgress: (
		root: string,
		entry: RalphProgressEntry,
	) => Promise<RalphProgressEntry>;
}

export interface RalphReviewLoopResult {
	ok: boolean;
	storyId: string;
	state: RalphStory["state"];
	rounds: number;
	reason?: string;
}

export interface RalphRunLoopResult {
	mode: "run";
	ok: boolean;
	iterations: number;
	completedStories: number;
	blockedStories: number;
	reason?: string;
}

export interface RalphReviewStoryResult {
	mode: "review";
	ok: boolean;
	storyId: string;
	state: RalphStory["state"];
	rounds: number;
	reason?: string;
}

export interface RalphApproveStoryResult {
	mode: "approve";
	ok: boolean;
	storyId: string;
	state: RalphStory["state"];
	reason?: string;
}

export interface RalphPromoteLearningResult {
	mode: "promote-learning";
	storyId: string;
	candidates: ReturnType<typeof buildRalphLearningCandidate>[];
}

export interface RalphRunLoopAdapters {
	runStepProcess: (input: {
		root: string;
		iteration: number;
		timeoutMs: number | null;
	}) => Promise<{ ok: boolean; storyId?: string; reason?: string }>;
	runReviewProcess?: (input: {
		root: string;
		storyId: string;
		iteration: number;
		timeoutMs: number | null;
		}) => Promise<{
		ok: boolean;
		storyId: string;
		state: RalphStory["state"];
		rounds: number;
		reason?: string;
	}>;
}

const DEFAULT_RALPH_STEP_ADAPTERS: RalphStepAdapters = {
	setGoal,
	captureWorkspaceFiles: async (root) => {
		const result = await execa("git", ["status", "--porcelain"], {
			cwd: root,
			reject: false,
		});

		if (result.exitCode !== 0) {
			return [];
		}

		return result.stdout
			.split("\n")
			.filter(Boolean)
			.map(parseGitPorcelainPath)
			.filter(Boolean);
	},
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
		const files = input.files.filter((file) => isRelevantStoryFile(file));
		if (files.length === 0) {
			return { ok: false, reason: "No story files available for Ralph CI" };
		}

		const testFiles = files.filter((file) =>
			/\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
		);
		if (testFiles.length > 0) {
			const testResult = await execa("bun", ["test", ...testFiles], {
				cwd: input.root,
				reject: false,
				env: {
					...process.env,
					NOOA_DISABLE_REFLECTION: "1",
				},
			});

			if (testResult.exitCode !== 0) {
				return {
					ok: false,
					reason: testResult.stderr || testResult.stdout || "Tests failed",
				};
			}
		}

		const lintableFiles = files.filter((file) =>
			/\.(cjs|css|cts|js|json|jsx|mjs|mts|ts|tsx)$/.test(file),
		);
		if (lintableFiles.length > 0) {
			for (const file of lintableFiles) {
				await normalizeEscapedLineBreaks(input.root, file);
			}

			const formatResult = await execa(
				"bunx",
				["biome", "format", "--write", ...lintableFiles],
				{
					cwd: input.root,
					reject: false,
					env: {
						...process.env,
						NOOA_DISABLE_REFLECTION: "1",
					},
				},
			);
			if (formatResult.exitCode !== 0) {
				return {
					ok: false,
					reason:
						formatResult.stderr || formatResult.stdout || "Format failed",
				};
			}

			const lintResult = await execa(
				"bunx",
				["biome", "check", ...lintableFiles],
				{
					cwd: input.root,
					reject: false,
					env: {
						...process.env,
						NOOA_DISABLE_REFLECTION: "1",
					},
				},
			);

			if (lintResult.exitCode !== 0) {
				return {
					ok: false,
					reason: lintResult.stderr || lintResult.stdout || "Lint failed",
				};
			}
		}

		const policyResult = await new PolicyEngine(input.root).checkFiles(files);
		if (!policyResult.ok) {
			return {
				ok: false,
				reason: `Policy violations: ${policyResult.violations.length}`,
			};
		}

		return { ok: true };
	},
	inspectTestFailure: async (input) => {
		const result = await execa(
			process.execPath,
			[
				"run",
				"index.ts",
				"debug",
				"inspect-test-failure",
				"--json",
				"--",
				...input.command,
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
			throw new Error(
				result.stderr || result.stdout || "inspect-test-failure failed",
			);
		}

		return JSON.parse(result.stdout) as {
			mode: "inspect-test-failure";
			state?: string;
			source?: string[];
			stack?: Array<{ file: string; line: number; column?: number }>;
			exception?: { reason?: string; message?: string };
		};
	},
	inspectProfile: async (input) => {
		const result = await execa(
			process.execPath,
			["run", "index.ts", "profile", "inspect", "--json", "--", ...input.command],
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
			throw new Error(result.stderr || result.stdout || "profile inspect failed");
		}

		const parsed = JSON.parse(result.stdout) as {
			investigation?: RalphProgressInvestigation;
		};
		if (!parsed.investigation) {
			throw new Error("profile inspect returned no investigation");
		}
		return parsed.investigation;
	},
	appendProgress: appendRalphProgressEntry,
};

const DEFAULT_RALPH_REVIEW_LOOP_ADAPTERS: RalphReviewLoopAdapters = {
	setGoal,
	runWorker: DEFAULT_RALPH_STEP_ADAPTERS.runWorker,
	runReview: async (input) => {
		const files = await resolveStoryReviewFiles(input.root, input.story);
		if (files.length === 0) {
			throw new Error(
				`No story files found for review (${input.story.id}); cannot run peer review`,
			);
		}

		const aggregatedFindings: Array<{ severity: string; message: string }> = [];
		const summaries: string[] = [];

		for (const file of files) {
			const args = ["run", "index.ts", "review", file, "--json"];
			const result = await execa(process.execPath, args, {
				cwd: input.root,
				reject: false,
				timeout: input.timeoutMs ?? undefined,
				env: {
					...process.env,
					NOOA_DISABLE_REFLECTION: "1",
					NOOA_AI_PROVIDER: input.provider ?? process.env.NOOA_AI_PROVIDER,
					NOOA_AI_MODEL: input.model ?? process.env.NOOA_AI_MODEL,
				},
			});

			const parsed = parseReviewJson(result.stdout);
			if (!parsed) {
				if (result.exitCode !== 0) {
					throw new Error(
						result.stderr || result.stdout || "Review execution failed",
					);
				}
				throw new Error(`Unable to parse review output for ${file}`);
			}

			if (parsed.summary) {
				summaries.push(`[${file}] ${parsed.summary}`);
			}
			for (const finding of parsed.findings ?? []) {
				aggregatedFindings.push({
					severity: finding.severity,
					message: `[${file}] ${finding.message}`,
				});
			}
		}

		return {
			ok: aggregatedFindings.length === 0,
			findings: aggregatedFindings,
			summary:
				summaries.join("\n").trim() ||
				`Reviewed ${files.length} file(s) with no findings.`,
		};
	},
	appendProgress: appendRalphProgressEntry,
};

const DEFAULT_RALPH_RUN_LOOP_ADAPTERS: RalphRunLoopAdapters = {
	runStepProcess: async (input) => {
		const result = await execa(
			process.execPath,
			["run", "index.ts", "ralph", "step", "--json"],
			{
				cwd: input.root,
				reject: false,
				timeout: input.timeoutMs ?? undefined,
				env: {
					...process.env,
					NOOA_DISABLE_REFLECTION: "1",
				},
			},
		);

		if (result.exitCode !== 0) {
			throw new Error(result.stderr || result.stdout || "Ralph step failed");
		}

		const parsed = parseRalphCommandJson(result.stdout) as {
			ok: boolean;
			storyId?: string;
			reason?: string;
		};
		if (!parsed || typeof parsed.ok !== "boolean") {
			throw new Error("Unable to parse Ralph step output");
		}
		return parsed;
	},
	runReviewProcess: async (input) => {
		const result = await execa(
			process.execPath,
			[
				"run",
				"index.ts",
				"ralph",
				"review",
				"--story",
				input.storyId,
				"--json",
			],
			{
				cwd: input.root,
				reject: false,
				timeout: input.timeoutMs ?? undefined,
				env: {
					...process.env,
					NOOA_DISABLE_REFLECTION: "1",
				},
			},
		);

		if (result.exitCode !== 0) {
			throw new Error(result.stderr || result.stdout || "Ralph review failed");
		}

		const parsed = parseRalphCommandJson(result.stdout) as {
			ok: boolean;
			storyId: string;
			state: RalphStory["state"];
			rounds: number;
			reason?: string;
		};
		if (!parsed || typeof parsed.ok !== "boolean" || !parsed.storyId) {
			throw new Error("Unable to parse Ralph review output");
		}
		return parsed;
	},
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

function buildRalphTestFailureNotes(
	ciReason: string,
	inspection?: {
		source?: string[];
		stack?: Array<{ file: string; line: number; column?: number }>;
		exception?: { reason?: string; message?: string };
	},
): string[] {
	const notes = ["CI verification failed.", ciReason];
	if (inspection?.exception?.message) {
		notes.push(`Test failure: ${inspection.exception.message}`);
	}
	const frame = inspection?.stack?.[0];
	if (frame) {
		notes.push(
			`Failure location: ${frame.file}:${frame.line}${frame.column ? `:${frame.column}` : ""}`,
		);
	}
	if (inspection?.source?.length) {
		notes.push(`Failure source:\n${inspection.source.join("\n")}`);
	}
	return notes;
}

function buildRalphTestFailureInvestigation(inspection?: {
	source?: string[];
	stack?: Array<{ file: string; line: number; column?: number }>;
	exception?: { reason?: string; message?: string };
}): RalphProgressInvestigation | undefined {
	if (!inspection) {
		return undefined;
	}

	const frame = inspection.stack?.[0];
	if (!inspection.exception?.message && !frame && !inspection.source?.length) {
		return undefined;
	}

	return {
		kind: "test_failure",
		reason: inspection.exception?.reason ?? "test_failure",
		message: inspection.exception?.message,
		location: frame
			? {
					file: frame.file,
					line: frame.line,
					column: frame.column,
				}
			: undefined,
		source: inspection.source?.length ? inspection.source : undefined,
	};
}

function mergeRalphStoryNotes(existing: string, notes: string[]): string {
	const normalizedExisting = existing.trim();
	const normalizedIncoming = notes
		.map((note) => note.trim())
		.filter(Boolean)
		.join("\n");
	if (!normalizedExisting) {
		return normalizedIncoming;
	}
	if (!normalizedIncoming) {
		return normalizedExisting;
	}
	return `${normalizedExisting}\n\n${normalizedIncoming}`;
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
	const hardConstraints = [
		"- Use ONLY NOOA CLI commands.",
		"- Do NOT use external shell commands (mkdir, find, ls, cat, etc).",
		"- Do NOT use `nooa scaffold command` for product/story implementation.",
		"- Prefer `nooa code write` and `nooa code patch` for file edits.",
		"- Use repository-relative paths only (never absolute paths, never `.worktrees/...`).",
	];
	const knownFailureContext = story.notes.trim()
		? `\n\nKnown failure context:\n${story.notes}`
		: "";

	return `Implement story ${story.id}: ${story.title}

${story.description}

Acceptance criteria:
${story.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}

Execution constraints:
${hardConstraints.join("\n")}${knownFailureContext}`;
}

function buildRalphCorrectionGoal(
	story: RalphStory,
	findings: Array<{ severity: string; message: string }>,
): string {
	return `Revise story ${story.id}: ${story.title}

Address the reviewer findings:
${findings.map((finding) => `- [${finding.severity}] ${finding.message}`).join("\n")}`;
}

function getNextReviewState(state: RalphStory["state"]): RalphStory["state"] {
	if (state === "peer_fix_1") {
		return "peer_review_2";
	}
	if (state === "peer_fix_2") {
		return "peer_review_3";
	}
	throw new Error(`Story is not ready for another review round from ${state}`);
}

function finalizeApprovedStory(story: RalphStory): RalphStory {
	const committed = transitionRalphStoryState(story, "committed");
	return transitionRalphStoryState(committed, "passed");
}

function findReviewCandidate(prd: RalphPrd): RalphStory | null {
	return (
		[...prd.userStories]
			.filter(
				(story) =>
					!story.passes &&
					(story.state === "peer_review_1" ||
						story.state === "peer_review_2" ||
						story.state === "peer_review_3"),
			)
			.sort((left, right) => left.priority - right.priority)[0] ?? null
	);
}

function rankRalphCandidateForExecution(story: RalphStory): number {
	if (story.state === "failed") {
		return 0;
	}
	if (story.state === undefined || story.state === "pending") {
		return 1;
	}
	return 2;
}

function shouldProfileRalphStory(story: RalphStory): boolean {
	const text = [
		story.title,
		story.description,
		...(story.acceptanceCriteria ?? []),
		story.notes,
	]
		.filter(Boolean)
		.join("\n")
		.toLowerCase();
	return /(performance|cpu|hotspot|latency|throughput|profile)/.test(text);
}

function getRalphProfileCommandHint(story: RalphStory): string[] | null {
	if (story.profileCommand?.length) {
		return story.profileCommand;
	}
	return null;
}

export async function executeRalphReviewLoop(
	input?: {
		root?: string;
		storyId?: string;
	},
	adapters: RalphReviewLoopAdapters = DEFAULT_RALPH_REVIEW_LOOP_ADAPTERS,
): Promise<RalphReviewLoopResult> {
	const root = input?.root ?? process.cwd();
	const state = await loadRalphState(root);
	const workerTurns = resolveRalphWorkerTurns();
	if (!state) {
		throw new Error("No active Ralph run in this workspace");
	}

	assertDistinctRalphReviewerIdentity(state, { strict: true });

	const prd = await loadRalphPrd(root);
	const storyId = input?.storyId ?? state.currentStoryId;
	if (!storyId) {
		throw new Error("No active Ralph story available for review");
	}

	const storyIndex = prd.userStories.findIndex((story) => story.id === storyId);
	if (storyIndex === -1) {
		throw new Error(`Unable to locate story ${storyId} in PRD`);
	}

	const initialStory = prd.userStories[storyIndex];
	if (!initialStory) {
		throw new Error(`Unable to locate story ${storyId} in PRD`);
	}

	let activeStory: RalphStory = initialStory;
	if (
		activeStory.state !== "peer_review_1" &&
		activeStory.state !== "peer_review_2" &&
		activeStory.state !== "peer_review_3"
	) {
		throw new Error(`Story ${storyId} is not awaiting peer review`);
	}

	await acquireRalphStateLock(root, `ralph-review:${process.pid}`);

	try {
		while (
			activeStory.state === "peer_review_1" ||
			activeStory.state === "peer_review_2" ||
			activeStory.state === "peer_review_3"
		) {
			let reviewResult: Awaited<
				ReturnType<RalphReviewLoopAdapters["runReview"]>
			>;
			try {
				reviewResult = await adapters.runReview({
					root,
					story: activeStory,
					provider: state.reviewer.provider,
					model: state.reviewer.model,
					temperature: state.reviewer.temperature,
					timeoutMs: state.timeouts.reviewerMs,
				});
			} catch (error) {
				state.status = "blocked";
				await saveRalphState(root, state);
				const message = error instanceof Error ? error.message : String(error);
				await adapters.appendProgress(root, {
					runId: state.runId,
					storyId: activeStory.id,
					iteration: activeStory.review?.rounds ?? 0,
					status: "failed",
					notes: [message],
				});
				return {
					ok: false,
					storyId: activeStory.id,
					state: activeStory.state ?? "peer_review_1",
					rounds: activeStory.review?.rounds ?? 0,
					reason: message,
				};
			}

			if (reviewResult.ok && reviewResult.findings.length === 0) {
				const approvedStory = markRalphStoryApproved(activeStory, {
					reviewer: {
						provider: state.reviewer.provider,
						model: state.reviewer.model,
						temperature: state.reviewer.temperature,
					},
					notes: reviewResult.summary ? [reviewResult.summary] : [],
				});
				activeStory = finalizeApprovedStory(approvedStory);
				prd.userStories[storyIndex] = activeStory;
				await saveRalphPrd(root, prd);
				await adapters.appendProgress(root, {
					runId: state.runId,
					storyId: activeStory.id,
					iteration: activeStory.review?.rounds ?? 1,
					status: "passed",
					reviewRounds: activeStory.review?.rounds,
					reviewers: [state.reviewer.model ?? "reviewer"],
					learnings: reviewResult.summary
						? [
								buildRalphLearningCandidate({
									text: reviewResult.summary,
									observedInStories: 1,
									peerReviewed: true,
									affectsReusablePattern: true,
								}),
							]
						: undefined,
					notes: reviewResult.summary ? [reviewResult.summary] : undefined,
				});
				return {
					ok: true,
					storyId: activeStory.id,
					state: activeStory.state ?? "passed",
					rounds: activeStory.review?.rounds ?? 1,
				};
			}

			activeStory = recordRalphPeerReview(activeStory, {
				reviewer: {
					provider: state.reviewer.provider,
					model: state.reviewer.model,
					temperature: state.reviewer.temperature,
				},
				approved: false,
				notes: reviewResult.findings.map((finding) => finding.message),
			});
			prd.userStories[storyIndex] = activeStory;
			await saveRalphPrd(root, prd);

			await adapters.appendProgress(root, {
				runId: state.runId,
				storyId: activeStory.id,
				iteration: activeStory.review?.rounds ?? 1,
				status: activeStory.state === "blocked" ? "blocked" : "reviewing",
				reviewRounds: activeStory.review?.rounds,
				reviewers: [state.reviewer.model ?? "reviewer"],
				learnings:
					reviewResult.findings.length > 0
						? reviewResult.findings.map((finding) =>
								buildRalphLearningCandidate({
									text: finding.message,
									observedInStories: activeStory.review?.rounds ?? 1,
									preventedFailure: true,
									peerReviewed: true,
									affectsReusablePattern: true,
								}),
							)
						: undefined,
				notes: reviewResult.findings.map((finding) => finding.message),
			});

			if (activeStory.state === "blocked") {
				state.status = "blocked";
				await saveRalphState(root, state);
				return {
					ok: false,
					storyId: activeStory.id,
					state: "blocked",
					rounds: activeStory.review?.rounds ?? 3,
					reason:
						reviewResult.summary ??
						"Reviewer rejected the story after 3 rounds",
				};
			}

			const correctionGoal = buildRalphCorrectionGoal(
				activeStory,
				reviewResult.findings,
			);
			await adapters.setGoal(correctionGoal, root);
			try {
				await adapters.runWorker({
					root,
					goal: correctionGoal,
					story: activeStory,
					provider: state.worker.provider,
					model: state.worker.model,
					turns: workerTurns,
					headless: true,
					timeoutMs: state.timeouts.workerMs,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				activeStory = { ...activeStory, state: "failed" };
				prd.userStories[storyIndex] = activeStory;
				state.status = "blocked";
				await saveRalphPrd(root, prd);
				await saveRalphState(root, state);
				await adapters.appendProgress(root, {
					runId: state.runId,
					storyId: activeStory.id,
					iteration: activeStory.review?.rounds ?? 1,
					status: "failed",
					notes: [message],
				});
				return {
					ok: false,
					storyId: activeStory.id,
					state: "failed",
					rounds: activeStory.review?.rounds ?? 1,
					reason: message,
				};
			}

			activeStory = transitionRalphStoryState(
				activeStory,
				getNextReviewState(activeStory.state ?? "peer_review_1"),
			);
			prd.userStories[storyIndex] = activeStory;
			await saveRalphPrd(root, prd);
		}

		throw new Error(`Unexpected review loop termination for story ${storyId}`);
	} finally {
		await releaseRalphStateLock(root);
	}
}

export async function executeRalphReviewStory(
	input?: {
		root?: string;
		storyId?: string;
	},
	adapters: RalphReviewLoopAdapters = DEFAULT_RALPH_REVIEW_LOOP_ADAPTERS,
): Promise<RalphReviewStoryResult> {
	const result = await executeRalphReviewLoop(input, adapters);
	return {
		mode: "review",
		...result,
	};
}

export async function executeRalphApproveStory(input?: {
	root?: string;
	storyId?: string;
	notes?: string[];
}): Promise<RalphApproveStoryResult> {
	const root = input?.root ?? process.cwd();
	const state = await loadRalphState(root);
	if (!state) {
		throw new Error("No active Ralph run in this workspace");
	}

	const prd = await loadRalphPrd(root);
	const storyId = input?.storyId ?? state.currentStoryId;
	if (!storyId) {
		throw new Error("No active Ralph story available for approval");
	}

	const storyIndex = prd.userStories.findIndex((story) => story.id === storyId);
	if (storyIndex === -1) {
		throw new Error(`Unable to locate story ${storyId} in PRD`);
	}

	await acquireRalphStateLock(root, `ralph-approve:${process.pid}`);
	try {
		const story = prd.userStories[storyIndex];
		if (!story) {
			throw new Error(`Unable to locate story ${storyId} in PRD`);
		}
		if (
			story.state !== "peer_review_1" &&
			story.state !== "peer_review_2" &&
			story.state !== "peer_review_3"
		) {
			throw new Error(`Story ${storyId} is not awaiting peer review`);
		}

		const approvedStory = markRalphStoryApproved(story, {
			reviewer: {
				provider: state.reviewer.provider,
				model: state.reviewer.model,
				temperature: state.reviewer.temperature,
			},
			notes: input?.notes,
		});
		const passedStory = finalizeApprovedStory(approvedStory);
		prd.userStories[storyIndex] = passedStory;
		await saveRalphPrd(root, prd);
		await appendRalphProgressEntry(root, {
			runId: state.runId,
			storyId: passedStory.id,
			iteration: passedStory.review?.rounds ?? 1,
			status: "passed",
			reviewRounds: passedStory.review?.rounds,
			reviewers: [state.reviewer.model ?? "reviewer"],
			notes: input?.notes,
		});

		return {
			mode: "approve",
			ok: true,
			storyId: passedStory.id,
			state: passedStory.state ?? "passed",
		};
	} finally {
		await releaseRalphStateLock(root);
	}
}

export async function executeRalphPromoteLearning(input?: {
	root?: string;
	storyId?: string;
}): Promise<RalphPromoteLearningResult> {
	const root = input?.root ?? process.cwd();
	const state = await loadRalphState(root);
	if (!state) {
		throw new Error("No active Ralph run in this workspace");
	}

	const storyId = input?.storyId ?? state.currentStoryId;
	if (!storyId) {
		throw new Error("No active Ralph story available for learning promotion");
	}

	const candidates = (await loadRalphProgressEntries(root))
		.filter((entry) => entry.storyId === storyId)
		.flatMap((entry) => entry.learnings ?? []);

	return {
		mode: "promote-learning",
		storyId,
		candidates,
	};
}

export async function executeRalphRun(
	input?: {
		root?: string;
		maxIterations?: number;
		blockedThreshold?: number;
		stepTimeoutMs?: number | null;
	},
	adapters: RalphRunLoopAdapters = DEFAULT_RALPH_RUN_LOOP_ADAPTERS,
): Promise<RalphRunLoopResult> {
	const root = input?.root ?? process.cwd();
	const maxIterations = input?.maxIterations ?? 10;
	const blockedThreshold = input?.blockedThreshold ?? 1;
	const stepTimeoutMs = input?.stepTimeoutMs ?? null;

	const state = await loadRalphState(root);
	if (!state) {
		return {
			mode: "run",
			ok: false,
			iterations: 0,
			completedStories: 0,
			blockedStories: 0,
			reason: "No active Ralph run in this workspace",
		};
	}

	let initialPrd: RalphPrd;
	try {
		initialPrd = await loadRalphPrd(root);
	} catch {
		return {
			mode: "run",
			ok: false,
			iterations: 0,
			completedStories: 0,
			blockedStories: 0,
			reason: "No Ralph PRD loaded for this workspace",
		};
	}

	for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
		const prdBefore = iteration === 1 ? initialPrd : await loadRalphPrd(root);
		const completedBefore = prdBefore.userStories.filter(
			(story) => story.passes,
		).length;
		const blockedBefore = prdBefore.userStories.filter(
			(story) => story.state === "blocked",
		).length;

		if (blockedBefore >= blockedThreshold) {
			return {
				mode: "run",
				ok: false,
				iterations: iteration - 1,
				completedStories: completedBefore,
				blockedStories: blockedBefore,
				reason: "Blocked story threshold reached",
			};
		}

		if (
			prdBefore.userStories.length > 0 &&
			prdBefore.userStories.every((story) => story.passes)
		) {
			return {
				mode: "run",
				ok: true,
				iterations: iteration - 1,
				completedStories: completedBefore,
				blockedStories: blockedBefore,
			};
		}

		const reviewCandidate = findReviewCandidate(prdBefore);
		try {
			if (reviewCandidate && adapters.runReviewProcess) {
				await adapters.runReviewProcess({
					root,
					storyId: reviewCandidate.id,
					iteration,
					timeoutMs: stepTimeoutMs,
				});
			} else if (reviewCandidate) {
				await adapters.runStepProcess({
					root,
					iteration,
					timeoutMs: stepTimeoutMs,
				});
			} else {
				await adapters.runStepProcess({
					root,
					iteration,
					timeoutMs: stepTimeoutMs,
				});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const prdAfterFailure = await loadRalphPrd(root);
			return {
				mode: "run",
				ok: false,
				iterations: iteration,
				completedStories: prdAfterFailure.userStories.filter(
					(story) => story.passes,
				).length,
				blockedStories: prdAfterFailure.userStories.filter(
					(story) => story.state === "blocked",
				).length,
				reason: message,
			};
		}

		const prdAfter = await loadRalphPrd(root);
		const completedAfter = prdAfter.userStories.filter(
			(story) => story.passes,
		).length;
		const blockedAfter = prdAfter.userStories.filter(
			(story) => story.state === "blocked",
		).length;

		if (
			prdAfter.userStories.length > 0 &&
			prdAfter.userStories.every((story) => story.passes)
		) {
			return {
				mode: "run",
				ok: true,
				iterations: iteration,
				completedStories: completedAfter,
				blockedStories: blockedAfter,
			};
		}

		if (blockedAfter >= blockedThreshold) {
			return {
				mode: "run",
				ok: false,
				iterations: iteration,
				completedStories: completedAfter,
				blockedStories: blockedAfter,
				reason: "Blocked story threshold reached",
			};
		}
	}

	const finalPrd = await loadRalphPrd(root);
	return {
		mode: "run",
		ok: false,
		iterations: maxIterations,
		completedStories: finalPrd.userStories.filter((story) => story.passes)
			.length,
		blockedStories: finalPrd.userStories.filter(
			(story) => story.state === "blocked",
		).length,
		reason: "Max iterations reached before backlog completion",
	};
}

export async function executeRalphStep(
	input?: {
		root?: string;
	},
	adapters: RalphStepAdapters = DEFAULT_RALPH_STEP_ADAPTERS,
): Promise<RalphStepResult> {
	const root = input?.root ?? process.cwd();
	const state = await loadRalphState(root);
	const workerTurns = resolveRalphWorkerTurns();
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
	const currentStory = state.currentStoryId
		? (prd.userStories.find(
				(candidate) =>
					candidate.id === state.currentStoryId &&
					(candidate.state === "implementing" ||
						candidate.state === "verifying"),
			) ?? null)
		: null;
	const resumableStory =
		currentStory ??
		[...prd.userStories]
			.filter(
				(candidate) =>
					!candidate.passes &&
					(candidate.state === "implementing" ||
						candidate.state === "verifying"),
			)
			.sort((left, right) => left.priority - right.priority)[0] ??
		null;
	const story =
		resumableStory ??
		[...prd.userStories]
			.filter(
				(candidate) =>
					!candidate.passes &&
					candidate.state !== "blocked" &&
					(candidate.state === undefined ||
						candidate.state === "pending" ||
						candidate.state === "failed"),
			)
			.sort((left, right) => {
				const rankDelta =
					rankRalphCandidateForExecution(left) -
					rankRalphCandidateForExecution(right);
				if (rankDelta !== 0) {
					return rankDelta;
				}
				return left.priority - right.priority;
			})[0] ??
		null;

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
		const initialWorkspaceFiles = await adapters.captureWorkspaceFiles(root);
		state.currentStoryId = story.id;
		state.status = "running";
		await saveRalphState(root, state);

		const storyIndex = prd.userStories.findIndex(
			(candidate) => candidate.id === story.id,
		);
		if (storyIndex === -1) {
			throw new Error(`Unable to locate story ${story.id} in PRD`);
		}

		const currentStory = prd.userStories[storyIndex];
		if (!currentStory) {
			throw new Error(`Unable to locate story ${story.id} in PRD`);
		}
		const resumedFromVerifying = currentStory.state === "verifying";
		const expectedArtifacts = extractExpectedArtifactPaths(currentStory);
		const artifactSignaturesBefore = await captureArtifactSignatures(
			root,
			expectedArtifacts,
		);

		let activeStory =
			currentStory.state === "implementing" ||
			currentStory.state === "verifying"
				? {
						...currentStory,
						state: currentStory.state,
					}
				: transitionRalphStoryState(
						{
							...currentStory,
							state: currentStory.state ?? "pending",
						},
						"implementing",
					);
		prd.userStories[storyIndex] = activeStory;
		await saveRalphPrd(root, prd);

		const shouldRunWorker =
			activeStory.state !== "verifying" ||
			!hasStoryEvidence(root, activeStory, initialWorkspaceFiles);
		let workerFailureMessage: string | null = null;
		if (shouldRunWorker) {
			const goal = buildRalphStoryGoal(activeStory);
			await adapters.setGoal(goal, root);

			try {
				const workerResult = await adapters.runWorker({
					root,
					goal,
					story: activeStory,
					provider: state.worker.provider,
					model: state.worker.model,
					turns: workerTurns,
					headless: true,
					timeoutMs: state.timeouts.workerMs,
				});

				if (!workerResult.ok) {
					workerFailureMessage =
						workerResult.finalAnswer || "Worker execution failed";
				}
			} catch (error) {
				workerFailureMessage =
					error instanceof Error ? error.message : String(error);
			}

			if (activeStory.state !== "verifying") {
				activeStory = transitionRalphStoryState(activeStory, "verifying");
				prd.userStories[storyIndex] = activeStory;
				await saveRalphPrd(root, prd);
			}
		}

		const currentWorkspaceFiles = await adapters.captureWorkspaceFiles(root);
		const derivedStoryFiles = deriveStoryFiles(
			initialWorkspaceFiles,
			currentWorkspaceFiles,
		);
		let storyFiles = derivedStoryFiles;
		if (storyFiles.length === 0) {
			const changedExpectedArtifacts = await detectChangedArtifacts(
				root,
				artifactSignaturesBefore,
			);
			storyFiles = changedExpectedArtifacts.filter((file) =>
				isRelevantStoryFile(file),
			);
		}
		if (storyFiles.length === 0) {
			if (resumedFromVerifying) {
				storyFiles = expectedArtifacts.filter((file) =>
					existsSync(join(root, file)),
				);
			}
		}
		if (storyFiles.length === 0) {
			activeStory = { ...activeStory, state: "failed" };
			prd.userStories[storyIndex] = activeStory;
			state.status = "blocked";
			await saveRalphPrd(root, prd);
			await saveRalphState(root, state);
			await adapters.appendProgress(root, {
				runId: state.runId,
				storyId: activeStory.id,
				iteration: 1,
				status: "failed",
				notes: [
					"No implementation evidence detected for this story. Ralph requires changed files outside internal state.",
					...(workerFailureMessage ? [workerFailureMessage] : []),
				],
			});
			return {
				mode: "step",
				ok: false,
				storyId: activeStory.id,
				state: activeStory.state,
				reason: "No implementation evidence detected for this story",
			};
		}

		if (workerFailureMessage && storyFiles.length === 0) {
			activeStory = { ...activeStory, state: "failed" };
			prd.userStories[storyIndex] = activeStory;
			state.status = "blocked";
			await saveRalphPrd(root, prd);
			await saveRalphState(root, state);
			await adapters.appendProgress(root, {
				runId: state.runId,
				storyId: activeStory.id,
				iteration: 1,
				status: "failed",
				notes: [
					workerFailureMessage,
					"Recoverable worker failures require actual changed files in this step.",
				],
			});
			return {
				mode: "step",
				ok: false,
				storyId: activeStory.id,
				state: activeStory.state,
				reason:
					"Recoverable worker failure had no changed files for this story",
			};
		}

		if (workerFailureMessage && !isRecoverableWorkerFailure(workerFailureMessage)) {
			activeStory = { ...activeStory, state: "failed" };
			prd.userStories[storyIndex] = activeStory;
			state.status = "blocked";
			await saveRalphPrd(root, prd);
			await saveRalphState(root, state);
			await adapters.appendProgress(root, {
				runId: state.runId,
				storyId: activeStory.id,
				iteration: 1,
				status: "failed",
				notes: [workerFailureMessage],
			});
			return {
				mode: "step",
				ok: false,
				storyId: activeStory.id,
				state: activeStory.state,
				reason: workerFailureMessage,
			};
		}

		const workflowResult = await adapters.runWorkflow({
			root,
			target: activeStory.id,
		});
		if (!workflowResult.ok) {
			throw new Error(workflowResult.reason || "Workflow verification failed");
		}

		const ciResult = await adapters.runCi({ root, files: storyFiles });
		if (!ciResult.ok) {
			const ciReason = ciResult.reason || "CI verification failed";
			const testFiles = storyFiles.filter((file) =>
				/\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
			);
			let inspection:
				| {
						source?: string[];
						stack?: Array<{ file: string; line: number; column?: number }>;
						exception?: { message?: string };
				  }
				| undefined;
			if (testFiles.length > 0 && adapters.inspectTestFailure) {
				try {
					inspection = await adapters.inspectTestFailure({
						root,
						command: ["bun", "test", ...testFiles],
					});
				} catch {}
			}
			const failureNotes = buildRalphTestFailureNotes(ciReason, inspection);
			const investigation = buildRalphTestFailureInvestigation(inspection);

			activeStory = {
				...activeStory,
				state: "failed",
				notes: mergeRalphStoryNotes(activeStory.notes, failureNotes),
			};
			prd.userStories[storyIndex] = activeStory;
			state.status = "blocked";
			await saveRalphPrd(root, prd);
			await saveRalphState(root, state);
			await adapters.appendProgress(root, {
				runId: state.runId,
				storyId: activeStory.id,
				iteration: 1,
				status: "failed",
				gates: {
					workflow: true,
					ci: false,
				},
				notes: failureNotes,
				investigation,
			});
			throw new Error(ciReason);
		}

		activeStory = transitionRalphStoryState(activeStory, "peer_review_1");
		prd.userStories[storyIndex] = activeStory;
		await saveRalphPrd(root, prd);

		let successInvestigation: RalphProgressInvestigation | undefined;
		const testFiles = storyFiles.filter((file) =>
			/\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
		);
		const hintedProfileCommand = getRalphProfileCommandHint(activeStory);
		if (
			shouldProfileRalphStory(activeStory) &&
			adapters.inspectProfile
		) {
			try {
				const profileCommand =
					hintedProfileCommand ??
					(testFiles.length > 0 ? ["bun", "test", ...testFiles] : null);
				if (profileCommand) {
				successInvestigation = await adapters.inspectProfile({
					root,
					command: profileCommand,
				});
				}
			} catch {}
		}

		await adapters.appendProgress(root, {
			runId: state.runId,
			storyId: activeStory.id,
			iteration: 1,
			status: "reviewing",
			gates: {
				workflow: true,
				ci: true,
			},
			investigation: successInvestigation,
			notes: [
				"Story executed and moved into peer review.",
				...(workerFailureMessage
					? [
							`Worker reported unfinished goal but produced implementation artifacts: ${workerFailureMessage}`,
						]
					: []),
			],
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

function deriveStoryFiles(before: string[], after: string[]) {
	const beforeSet = new Set(before);
	return after.filter(
		(file) => !beforeSet.has(file) && isRelevantStoryFile(file),
	);
}

function isRelevantStoryFile(file: string) {
	return (
		!file.startsWith(".nooa/") &&
		!file.startsWith("memory/") &&
		file !== "nooa.db" &&
		!file.startsWith("src/features/replay/tmp-replay/")
	);
}

function parseGitPorcelainPath(line: string) {
	const trimmed = line.trimEnd();
	if (trimmed.length <= 3) {
		return "";
	}

	const pathPart = trimmed.slice(3).trim();
	if (pathPart.includes(" -> ")) {
		return pathPart.split(" -> ").at(-1)?.trim() ?? "";
	}

	return pathPart;
}

function parseReviewJson(stdout: string) {
	if (!stdout.trim()) {
		return null;
	}

	try {
		return JSON.parse(stdout) as {
			ok?: boolean;
			summary?: string;
			findings?: Array<{ severity: string; message: string }>;
		};
	} catch {
		const match = stdout.match(/\{[\s\S]*\}\s*$/);
		if (!match) {
			return null;
		}
		try {
			return JSON.parse(match[0]) as {
				ok?: boolean;
				summary?: string;
				findings?: Array<{ severity: string; message: string }>;
			};
		} catch {
			return null;
		}
	}
}

async function normalizeEscapedLineBreaks(root: string, file: string) {
	const fullPath = join(root, file);
	let content = "";
	try {
		content = await readFile(fullPath, "utf-8");
	} catch {
		return;
	}

	if (!content.includes("\\n")) {
		return;
	}

	const lineBreakCount = content.split("\n").length - 1;
	const escapedBreakCount = content.split("\\n").length - 1;
	if (escapedBreakCount === 0) {
		return;
	}

	// Recovery for malformed model output that serializes literal "\n" tokens.
	if (lineBreakCount <= 1 || escapedBreakCount > lineBreakCount) {
		const normalized = content.replaceAll("\\n", "\n").replaceAll("\\t", "\t");
		await writeFile(fullPath, normalized, "utf-8");
	}
}

type ArtifactSignature = {
	path: string;
	signature: string | null;
};

async function captureArtifactSignatures(root: string, files: string[]) {
	const signatures: ArtifactSignature[] = [];
	for (const file of files) {
		const fullPath = join(root, file);
		try {
			const content = await readFile(fullPath, "utf-8");
			signatures.push({
				path: file,
				signature: `${content.length}:${content.slice(0, 128)}:${content.slice(-128)}`,
			});
		} catch {
			signatures.push({ path: file, signature: null });
		}
	}
	return signatures;
}

async function detectChangedArtifacts(
	root: string,
	before: ArtifactSignature[],
): Promise<string[]> {
	const changed: string[] = [];
	for (const artifact of before) {
		const fullPath = join(root, artifact.path);
		let afterSignature: string | null = null;
		try {
			const content = await readFile(fullPath, "utf-8");
			afterSignature = `${content.length}:${content.slice(0, 128)}:${content.slice(-128)}`;
		} catch {
			afterSignature = null;
		}

		if (afterSignature !== artifact.signature) {
			changed.push(artifact.path);
		}
	}
	return changed;
}

function parseRalphCommandJson(stdout: string) {
	const trimmed = stdout.trim();
	if (!trimmed) {
		return null;
	}

	const telemetryBoundary = trimmed.indexOf('\n{"level":"');
	const candidate =
		telemetryBoundary >= 0 ? trimmed.slice(0, telemetryBoundary).trim() : trimmed;
	try {
		return JSON.parse(candidate) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function isRecoverableWorkerFailure(message: string) {
	return (
		/goal not achieved after \d+ turns?/i.test(message) ||
		message.trim().toLowerCase() === "worker execution failed"
	);
}

function resolveRalphWorkerTurns() {
	const raw = process.env.NOOA_WORKER_TURNS;
	if (!raw) {
		return 8;
	}
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return 8;
	}
	return Math.min(parsed, 64);
}

function hasStoryEvidence(
	root: string,
	story: RalphStory,
	workspaceFiles: string[],
) {
	const relevantWorkspaceFiles = workspaceFiles.filter((file) =>
		isRelevantStoryFile(file),
	);
	if (relevantWorkspaceFiles.length > 0) {
		return true;
	}

	const expectedArtifacts = extractExpectedArtifactPaths(story);
	return expectedArtifacts.some((file) => existsSync(join(root, file)));
}

function extractExpectedArtifactPaths(story: RalphStory) {
	const text = [
		story.title,
		story.description,
		story.notes,
		...(story.acceptanceCriteria ?? []),
	]
		.filter(Boolean)
		.join("\n");
	const matches =
		text.match(/\b[\w./-]+\.(html|css|js|ts|tsx|json|md)\b/gi) ?? [];
	return Array.from(new Set(matches.map((match) => match.trim())));
}

async function resolveStoryReviewFiles(root: string, story: RalphStory) {
	const expectedArtifacts = extractExpectedArtifactPaths(story)
		.filter((file) => isRelevantStoryFile(file))
		.filter((file) => existsSync(join(root, file)));
	if (expectedArtifacts.length > 0) {
		return expectedArtifacts;
	}

	const status = await execa("git", ["status", "--porcelain"], {
		cwd: root,
		reject: false,
	});
	if (status.exitCode !== 0) {
		return [];
	}

	return status.stdout
		.split("\n")
		.filter(Boolean)
		.map(parseGitPorcelainPath)
		.filter((file) => isRelevantStoryFile(file));
}
