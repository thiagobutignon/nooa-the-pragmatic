import {
	mkdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export type RalphStoryState =
	| "pending"
	| "implementing"
	| "verifying"
	| "peer_review_1"
	| "peer_fix_1"
	| "peer_review_2"
	| "peer_fix_2"
	| "peer_review_3"
	| "approved"
	| "committed"
	| "passed"
	| "failed"
	| "blocked";

export interface RalphReviewerIdentity {
	provider: string | null;
	model: string | null;
	temperature?: number;
}

export interface RalphReviewRecord {
	round: 1 | 2 | 3;
	verdict: "approved" | "changes_requested";
	reviewer: RalphReviewerIdentity;
	recordedAt: string;
	notes: string[];
}

export interface RalphStoryReviewState {
	rounds: number;
	records: RalphReviewRecord[];
	approvedAt: string | null;
}

export interface RalphStoryRecord {
	id: string;
	title: string;
	description: string;
	acceptanceCriteria: string[];
	priority: number;
	passes: boolean;
	notes: string;
	state?: RalphStoryState;
	review?: RalphStoryReviewState;
}

export interface RalphState {
	version: string;
	runId: string;
	branchName: string;
	status: "idle" | "ready" | "running" | "completed" | "blocked";
	currentStoryId: string | null;
	worker: {
		provider: string | null;
		model: string | null;
	};
	reviewer: {
		provider: string | null;
		model: string | null;
		temperature: number;
	};
	timeouts: {
		workerMs: number | null;
		reviewerMs: number | null;
	};
	createdAt: string;
	updatedAt: string;
}

const ALLOWED_RALPH_STORY_TRANSITIONS: Record<
	RalphStoryState,
	RalphStoryState[]
> = {
	pending: ["implementing"],
	implementing: ["verifying", "failed"],
	verifying: ["peer_review_1", "failed"],
	peer_review_1: ["peer_fix_1", "approved", "blocked"],
	peer_fix_1: ["peer_review_2", "failed"],
	peer_review_2: ["peer_fix_2", "approved", "blocked"],
	peer_fix_2: ["peer_review_3", "failed"],
	peer_review_3: ["approved", "blocked"],
	approved: ["committed"],
	committed: ["passed"],
	passed: [],
	failed: ["implementing", "blocked"],
	blocked: [],
};

export function createDefaultRalphState(input: {
	runId: string;
	branchName: string;
	workerProvider?: string;
	workerModel?: string;
	reviewerProvider?: string;
	reviewerModel?: string;
	workerTimeoutMs?: number;
	reviewerTimeoutMs?: number;
}): RalphState {
	const now = new Date().toISOString();
	return {
		version: "1.0.0",
		runId: input.runId,
		branchName: input.branchName,
		status: "ready",
		currentStoryId: null,
		worker: {
			provider: input.workerProvider ?? null,
			model: input.workerModel ?? null,
		},
		reviewer: {
			provider: input.reviewerProvider ?? null,
			model: input.reviewerModel ?? null,
			temperature: 0,
		},
		timeouts: {
			workerMs: input.workerTimeoutMs ?? null,
			reviewerMs: input.reviewerTimeoutMs ?? null,
		},
		createdAt: now,
		updatedAt: now,
	};
}

export function getAllowedRalphStoryTransitions(
	state: RalphStoryState,
): RalphStoryState[] {
	return ALLOWED_RALPH_STORY_TRANSITIONS[state];
}

export function transitionRalphStoryState(
	story: RalphStoryRecord,
	nextState: RalphStoryState,
): RalphStoryRecord {
	const currentState = story.state ?? "pending";
	const allowed = getAllowedRalphStoryTransitions(currentState);
	if (!allowed.includes(nextState)) {
		throw new Error(
			`Invalid Ralph story transition: ${currentState} -> ${nextState}`,
		);
	}

	return {
		...story,
		state: nextState,
		passes: nextState === "passed" ? true : story.passes,
	};
}

function getRalphReviewRound(state: RalphStoryState): 1 | 2 | 3 {
	switch (state) {
		case "peer_review_1":
			return 1;
		case "peer_review_2":
			return 2;
		case "peer_review_3":
			return 3;
		default:
			throw new Error(`Story is not in a peer review state: ${state}`);
	}
}

export function recordRalphPeerReview(
	story: RalphStoryRecord,
	input: {
		reviewer: RalphReviewerIdentity;
		approved: boolean;
		recordedAt?: string;
		notes?: string[];
	},
): RalphStoryRecord {
	const currentState = story.state ?? "pending";
	const round = getRalphReviewRound(currentState);
	const nextState = input.approved
		? "approved"
		: round === 1
			? "peer_fix_1"
			: round === 2
				? "peer_fix_2"
				: "blocked";
	const recordedAt = input.recordedAt ?? new Date().toISOString();
	const nextReview: RalphStoryReviewState = {
		rounds: round,
		approvedAt: input.approved
			? recordedAt
			: (story.review?.approvedAt ?? null),
		records: [
			...(story.review?.records ?? []),
			{
				round,
				verdict: input.approved ? "approved" : "changes_requested",
				reviewer: input.reviewer,
				recordedAt,
				notes: input.notes ?? [],
			},
		],
	};

	return {
		...transitionRalphStoryState(story, nextState),
		review: nextReview,
	};
}

export function markRalphStoryApproved(
	story: RalphStoryRecord,
	input: {
		reviewer: RalphReviewerIdentity;
		recordedAt?: string;
		notes?: string[];
	},
): RalphStoryRecord {
	return recordRalphPeerReview(story, {
		reviewer: input.reviewer,
		approved: true,
		recordedAt: input.recordedAt,
		notes: input.notes,
	});
}

export function assertDistinctRalphReviewerIdentity(
	state: RalphState,
	options?: {
		strict?: boolean;
	},
): void {
	if (!options?.strict) {
		return;
	}

	const workerProvider = state.worker.provider ?? "";
	const workerModel = state.worker.model ?? "";
	const reviewerProvider = state.reviewer.provider ?? "";
	const reviewerModel = state.reviewer.model ?? "";

	if (
		workerProvider.length > 0 &&
		workerProvider === reviewerProvider &&
		workerModel.length > 0 &&
		workerModel === reviewerModel
	) {
		throw new Error(
			"Worker and reviewer must resolve to different provider/model identities in strict mode",
		);
	}
}

export function getRalphDir(root: string) {
	return join(root, ".nooa", "ralph");
}

export function getRalphStatePath(root: string) {
	return join(getRalphDir(root), "state.json");
}

export function getRalphStateLockPath(root: string) {
	return join(getRalphDir(root), "state.lock");
}

const DEFAULT_RALPH_LOCK_STALE_MS = 15 * 60 * 1000;

export async function loadRalphState(root: string): Promise<RalphState | null> {
	try {
		const raw = await readFile(getRalphStatePath(root), "utf-8");
		const parsed = JSON.parse(raw) as RalphState;
		return parsed;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.toLowerCase().includes("no such file")) {
			return null;
		}
		throw error;
	}
}

export async function saveRalphState(
	root: string,
	state: RalphState,
): Promise<void> {
	const dir = getRalphDir(root);
	await mkdir(dir, { recursive: true });
	const path = getRalphStatePath(root);
	const tmpPath = `${path}.tmp`;
	const nextState: RalphState = {
		...state,
		updatedAt: new Date().toISOString(),
	};
	await writeFile(tmpPath, JSON.stringify(nextState, null, 2));
	await rename(tmpPath, path);
}

export async function acquireRalphStateLock(
	root: string,
	owner: string,
): Promise<void> {
	await mkdir(getRalphDir(root), { recursive: true });
	const lockPath = getRalphStateLockPath(root);

	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			await writeFile(
				lockPath,
				JSON.stringify({ owner, acquiredAt: new Date().toISOString() }, null, 2),
				{ flag: "wx" },
			);
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.toLowerCase().includes("exist")) {
				throw error;
			}

			const stale = await isRalphLockStale(lockPath);
			if (!stale || attempt === 1) {
				throw new Error("Ralph state lock is already held");
			}

			await rm(lockPath, { force: true });
		}
	}
}

export async function releaseRalphStateLock(root: string): Promise<void> {
	await rm(getRalphStateLockPath(root), { force: true });
}

function parseOwnerPid(owner: string): number | null {
	const match = owner.match(/:(\d+)$/);
	if (!match) {
		return null;
	}

	const pid = Number.parseInt(match[1], 10);
	return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		const code =
			typeof error === "object" && error && "code" in error
				? String((error as { code?: string }).code)
				: "";
		if (code === "ESRCH") {
			return false;
		}
		return true;
	}
}

async function isRalphLockStale(lockPath: string): Promise<boolean> {
	const now = Date.now();
	const raw = await readFile(lockPath, "utf-8").catch(() => "");
	let owner = "";
	let acquiredAt = "";

	if (raw.trim()) {
		try {
			const parsed = JSON.parse(raw) as { owner?: unknown; acquiredAt?: unknown };
			if (typeof parsed.owner === "string") {
				owner = parsed.owner;
			}
			if (typeof parsed.acquiredAt === "string") {
				acquiredAt = parsed.acquiredAt;
			}
		} catch {
			// fall back to mtime-only stale detection when lock content is malformed
		}
	}

	const pid = parseOwnerPid(owner);
	if (pid !== null && !isPidAlive(pid)) {
		return true;
	}

	const acquiredAtMs = acquiredAt ? Date.parse(acquiredAt) : Number.NaN;
	if (Number.isFinite(acquiredAtMs)) {
		return now - acquiredAtMs > DEFAULT_RALPH_LOCK_STALE_MS;
	}

	const lockStat = await stat(lockPath).catch(() => null);
	if (!lockStat) {
		return true;
	}

	return now - lockStat.mtimeMs > DEFAULT_RALPH_LOCK_STALE_MS;
}
