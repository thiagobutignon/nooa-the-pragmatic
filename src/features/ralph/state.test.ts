import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRalphPrd, type RalphPrd, saveRalphPrd } from "./prd";
import {
	appendRalphProgressEntry,
	getRalphProgressJsonlPath,
	getRalphProgressPath,
	loadRalphProgressEntries,
} from "./progress";
import {
	acquireRalphStateLock,
	createDefaultRalphState,
	getRalphStateLockPath,
	getRalphStatePath,
	loadRalphState,
	releaseRalphStateLock,
	saveRalphState,
} from "./state";

const tempRoots: string[] = [];

async function createTempRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-state-"));
	tempRoots.push(root);
	return root;
}

afterEach(async () => {
	while (tempRoots.length > 0) {
		const root = tempRoots.pop();
		if (!root) continue;
		await rm(root, { recursive: true, force: true });
	}
});

describe("ralph state primitives", () => {
	test("saves and loads state.json", async () => {
		const root = await createTempRoot();
		const state = createDefaultRalphState({
			runId: "ralph-auth",
			branchName: "feature/ralph-auth",
			workerProvider: "openai",
			workerModel: "gpt-worker",
			reviewerProvider: "anthropic",
			reviewerModel: "claude-review",
			workerTimeoutMs: 300000,
			reviewerTimeoutMs: 120000,
		});

		await saveRalphState(root, state);

		const loaded = await loadRalphState(root);
		expect(loaded).not.toBeNull();
		expect(loaded?.runId).toBe("ralph-auth");
		expect(loaded?.branchName).toBe("feature/ralph-auth");
		expect(loaded?.worker.provider).toBe("openai");
		expect(loaded?.reviewer.model).toBe("claude-review");
		expect(loaded?.timeouts.workerMs).toBe(300000);
		expect(loaded?.timeouts.reviewerMs).toBe(120000);
		expect(Bun.file(getRalphStatePath(root)).size).toBeGreaterThan(0);
	});

	test("loads and saves a Ralph-compatible prd.json", async () => {
		const root = await createTempRoot();
		const prd: RalphPrd = {
			project: "NOOA",
			branchName: "ralph/auth-flow",
			description: "Implement auth flow",
			userStories: [
				{
					id: "US-001",
					title: "Add auth state",
					description: "As a user, I want auth state persisted.",
					acceptanceCriteria: ["Typecheck passes"],
					priority: 1,
					passes: false,
					notes: "",
					state: "pending",
				},
			],
		};

		await saveRalphPrd(root, prd);
		const loaded = await loadRalphPrd(root);

		expect(loaded.branchName).toBe("ralph/auth-flow");
		expect(loaded.userStories).toHaveLength(1);
		expect(loaded.userStories[0]?.state).toBe("pending");
	});

	test("appends progress entries to markdown and jsonl", async () => {
		const root = await createTempRoot();

		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-001",
			iteration: 1,
			status: "passed",
			reviewRounds: 2,
			reviewers: ["peer-review-1", "peer-review-2"],
			gates: { workflow: true, ci: true, review: true },
			notes: ["Added auth state persistence"],
		});

		const markdown = await Bun.file(getRalphProgressPath(root)).text();
		const jsonlEntries = await loadRalphProgressEntries(root);

		expect(markdown).toContain("US-001");
		expect(markdown).toContain("Added auth state persistence");
		expect(Bun.file(getRalphProgressJsonlPath(root)).size).toBeGreaterThan(0);
		expect(jsonlEntries).toHaveLength(1);
		expect(jsonlEntries[0]?.storyId).toBe("US-001");
		expect(jsonlEntries[0]?.reviewRounds).toBe(2);
	});

	test("acquires and releases the Ralph mutation lock", async () => {
		const root = await createTempRoot();

		await acquireRalphStateLock(root, "test-owner");
		const lockPath = getRalphStateLockPath(root);
		expect(await Bun.file(lockPath).exists()).toBe(true);

		const secondAttempt = acquireRalphStateLock(root, "second-owner");
		await expect(secondAttempt).rejects.toThrow(
			"Ralph state lock is already held",
		);

		await releaseRalphStateLock(root);
		expect(await Bun.file(lockPath).exists()).toBe(false);
	});

	test("reclaims stale lock before acquiring a new one", async () => {
		const root = await createTempRoot();
		const lockPath = getRalphStateLockPath(root);
		await Bun.write(
			lockPath,
			JSON.stringify(
				{
					owner: "ralph-step:999999",
					acquiredAt: "2000-01-01T00:00:00.000Z",
				},
				null,
				2,
			),
		);

		await acquireRalphStateLock(root, "fresh-owner");
		const lockRaw = await readFile(lockPath, "utf-8");
		expect(lockRaw).toContain("fresh-owner");
	});

	test("keeps active lock ownership when lock is not stale", async () => {
		const root = await createTempRoot();
		const lockPath = getRalphStateLockPath(root);
		await mkdir(join(root, ".nooa", "ralph"), { recursive: true });
		await writeFile(
			lockPath,
			JSON.stringify(
				{
					owner: "manual-owner",
					acquiredAt: new Date().toISOString(),
				},
				null,
				2,
			),
		);

		await expect(acquireRalphStateLock(root, "second-owner")).rejects.toThrow(
			"Ralph state lock is already held",
		);
	});

	test("returns null when state does not exist", async () => {
		const root = await createTempRoot();
		const loaded = await loadRalphState(root);
		expect(loaded).toBeNull();
	});
});
