import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeRalphRun } from "../ralph/execute";
import { getRalphPrdPath } from "../ralph/prd";
import { convertBacklogToRalphPrd, importBacklogIntoRalph } from "./ralph-bridge";
import type { BacklogPrd } from "./types";

function createBacklogPrd(): BacklogPrd {
	return {
		project: "NOOA",
		branchName: "feature/backlog-bridge",
		description: "Bridge fixture",
		userStories: [
			{
				id: "US-001",
				title: "Improve API latency",
				description: "Reduce latency",
				acceptanceCriteria: ["AC-1", "AC-2"],
				profileCommand: ["node", "scripts/profile-api.js"],
				priority: 1,
				passes: false,
				state: "pending",
			},
		],
	};
}

describe("backlog ralph bridge", () => {
	it("converts backlog stories into Ralph-compatible stories", () => {
		const ralphPrd = convertBacklogToRalphPrd(createBacklogPrd());

		expect(ralphPrd.userStories[0]?.notes).toBe("");
		expect(ralphPrd.userStories[0]?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
	});

	it("imports a backlog PRD directly into .nooa/ralph/prd.json", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-ralph-bridge-"));
		const inPath = join(root, "backlog.json");
		try {
			await writeFile(join(root, ".gitignore"), ".nooa/ralph/\n");
			await initializeRalphRun({
				root,
				runId: "ralph-bridge",
				branchName: "feature/backlog-bridge",
			});
			await writeFile(inPath, JSON.stringify(createBacklogPrd(), null, 2));

			const imported = await importBacklogIntoRalph({ root, path: inPath });
			const persisted = JSON.parse(
				await readFile(getRalphPrdPath(root), "utf8"),
			) as ReturnType<typeof convertBacklogToRalphPrd>;

			expect(imported.userStories[0]?.notes).toBe("");
			expect(persisted.userStories[0]?.id).toBe("US-001");
			expect(persisted.userStories[0]?.profileCommand).toEqual([
				"node",
				"scripts/profile-api.js",
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
