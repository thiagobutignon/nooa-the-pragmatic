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
});
