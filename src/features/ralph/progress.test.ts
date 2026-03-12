import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadReplay } from "../replay/storage";
import {
	appendRalphProgressEntry,
	getRalphProgressJsonlPath,
	getRalphProgressPath,
	loadRalphProgressEntries,
} from "./progress";

const tempRoots: string[] = [];

async function createTempRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-ralph-progress-"));
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

describe("ralph progress artifacts", () => {
	test("appends progress entries to markdown and jsonl", async () => {
		const root = await createTempRoot();

		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-001",
			iteration: 1,
			status: "reviewing",
			reviewRounds: 1,
			reviewers: ["claude-3.7"],
			gates: { workflow: true, ci: true },
			notes: ["Story entered peer review"],
		});

		const markdown = await Bun.file(getRalphProgressPath(root)).text();
		const jsonlEntries = await loadRalphProgressEntries(root);

		expect(markdown).toContain("US-001");
		expect(markdown).toContain("Story entered peer review");
		expect(Bun.file(getRalphProgressJsonlPath(root)).size).toBeGreaterThan(0);
		expect(jsonlEntries).toHaveLength(1);
		expect(jsonlEntries[0]?.storyId).toBe("US-001");
		expect(jsonlEntries[0]?.status).toBe("reviewing");
	});

	test("registers replay nodes and links story progression in order", async () => {
		const root = await createTempRoot();

		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-001",
			iteration: 1,
			status: "reviewing",
			notes: ["Worker completed and review started"],
		});
		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-001",
			iteration: 2,
			status: "approved",
			reviewRounds: 2,
			reviewers: ["claude-3.7"],
			notes: ["Approved after the second round"],
		});
		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-002",
			iteration: 1,
			status: "blocked",
			notes: ["Reviewer rejected after max rounds"],
		});

		const replay = await loadReplay(root);
		const us001Nodes = replay.nodes.filter((node) =>
			node.meta?.tags?.includes("story:US-001"),
		);
		const us002Nodes = replay.nodes.filter((node) =>
			node.meta?.tags?.includes("story:US-002"),
		);
		const us001Edges = replay.edges.filter(
			(edge) =>
				us001Nodes.some((node) => node.id === edge.from) &&
				us001Nodes.some((node) => node.id === edge.to) &&
				edge.kind === "next",
		);

		expect(us001Nodes).toHaveLength(2);
		expect(us002Nodes).toHaveLength(1);
		expect(us001Nodes[0]?.label).toContain("reviewing");
		expect(us001Nodes[1]?.label).toContain("approved");
		expect(us002Nodes[0]?.meta?.summary).toContain("blocked");
		expect(us001Edges).toHaveLength(1);
	});

	test("stores structured investigation metadata in replay nodes", async () => {
		const root = await createTempRoot();

		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-003",
			iteration: 1,
			status: "failed",
			notes: ["CI verification failed."],
			investigation: {
				kind: "test_failure",
				reason: "test_failure",
				message: "expect(received).toBe(expected)",
				location: {
					file: "/tmp/demo/failing.test.ts",
					line: 7,
					column: 3,
				},
				source: ["expect(1).toBe(2);"],
			},
		});

		const replay = await loadReplay(root);
		const node = replay.nodes.find((entry) =>
			entry.meta?.tags?.includes("story:US-003"),
		);

		expect(node?.meta?.tags).toContain("investigation:test_failure");
		expect(node?.meta?.summary).toContain("investigation=test_failure");
		expect(node?.meta?.summary).toContain("location=/tmp/demo/failing.test.ts:7:3");
		expect(node?.meta?.investigation).toEqual({
			kind: "test_failure",
			reason: "test_failure",
			message: "expect(received).toBe(expected)",
			location: {
				file: "/tmp/demo/failing.test.ts",
				line: 7,
				column: 3,
			},
			source: ["expect(1).toBe(2);"],
		});
	});

	test("adds an explicit retry edge after a failed story attempt", async () => {
		const root = await createTempRoot();

		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-004",
			iteration: 1,
			status: "failed",
			notes: ["CI verification failed."],
		});
		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-004",
			iteration: 2,
			status: "reviewing",
			notes: ["Retry entered review."],
		});

		const replay = await loadReplay(root);
		const us004Nodes = replay.nodes.filter((node) =>
			node.meta?.tags?.includes("story:US-004"),
		);
		const retryEdges = replay.edges.filter(
			(edge) =>
				edge.kind === "retry" &&
				us004Nodes.some((node) => node.id === edge.from) &&
				us004Nodes.some((node) => node.id === edge.to),
		);

		expect(us004Nodes).toHaveLength(2);
		expect(retryEdges).toHaveLength(1);
	});

	test("adds an explicit fix node when a failed story later passes", async () => {
		const root = await createTempRoot();

		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-005",
			iteration: 1,
			status: "failed",
			notes: ["CI verification failed."],
		});
		await appendRalphProgressEntry(root, {
			runId: "ralph-auth",
			storyId: "US-005",
			iteration: 2,
			status: "passed",
			notes: ["Approved after retry."],
		});

		const replay = await loadReplay(root);
		const storyNodes = replay.nodes.filter((node) =>
			node.meta?.tags?.includes("story:US-005"),
		);
		const fixNode = replay.nodes.find(
			(node) => node.type === "fix" && node.label === "Resolve US-005 failure",
		);
		const fixesEdge = replay.edges.find(
			(edge) =>
				edge.kind === "fixes" &&
				edge.from === fixNode?.id &&
				storyNodes.some((node) => node.id === edge.to),
		);
		const impactEdge = replay.edges.find(
			(edge) =>
				edge.kind === "impact" &&
				edge.from === fixNode?.id &&
				storyNodes.some((node) => node.id === edge.to),
		);

		expect(storyNodes).toHaveLength(2);
		expect(fixNode).toBeDefined();
		expect(fixesEdge).toBeDefined();
		expect(impactEdge).toBeDefined();
	});
});
