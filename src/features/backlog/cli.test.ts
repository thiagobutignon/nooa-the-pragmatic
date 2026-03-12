import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa backlog", () => {
	it("shows subcommand help contract", async () => {
		const res = await execa(bunPath, [binPath, "backlog", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});

		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa backlog");
		expect(res.stdout).toContain("generate");
		expect(res.stdout).toContain("validate");
		expect(res.stdout).toContain("split");
		expect(res.stdout).toContain("board");
		expect(res.stdout).toContain("move");
		expect(res.stdout).toContain("profile-command");
		expect(res.stdout).toContain("max-ac");
	});

	it("splits a PRD and preserves profileCommand on derived stories", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-split-"));
		const inPath = join(root, "prd.json");
		const outPath = join(root, "prd.split.json");
		await writeFile(
			inPath,
			JSON.stringify({
				project: "NOOA",
				branchName: "feature/perf-story",
				description: "Performance story",
				userStories: [
					{
						id: "US-001",
						title: "Improve API latency",
						description: "Reduce latency",
						acceptanceCriteria: ["AC-1", "AC-2", "AC-3", "AC-4"],
						profileCommand: ["node", "scripts/profile-api.js"],
						priority: 1,
						passes: false,
						state: "pending",
					},
				],
			}),
		);

		const res = await execa(
			bunPath,
			[
				binPath,
				"backlog",
				"split",
				"--in",
				inPath,
				"--out",
				outPath,
				"--max-ac",
				"2",
				"--json",
			],
			{
				reject: false,
				env: baseEnv,
				cwd: repoRoot,
			},
		);

		expect(res.exitCode).toBe(0);
		const persisted = JSON.parse(await readFile(outPath, "utf8"));
		expect(persisted.userStories).toHaveLength(2);
		expect(persisted.userStories[0]?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
	});

	it("renders board columns from a PRD", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-board-"));
		const inPath = join(root, "prd.json");
		await writeFile(
			inPath,
			JSON.stringify({
				project: "NOOA",
				branchName: "feature/backlog-board",
				description: "Board story",
				userStories: [
					{
						id: "US-001",
						title: "Todo story",
						description: "Pending work",
						acceptanceCriteria: ["AC-1"],
						priority: 1,
						passes: false,
						state: "pending",
					},
					{
						id: "US-002",
						title: "Review story",
						description: "Review work",
						acceptanceCriteria: ["AC-2"],
						priority: 2,
						passes: false,
						state: "peer_review_1",
					},
				],
			}),
		);

		const res = await execa(
			bunPath,
			[binPath, "backlog", "board", "--in", inPath, "--json"],
			{
				reject: false,
				env: baseEnv,
				cwd: repoRoot,
			},
		);

		expect(res.exitCode).toBe(0);
		const parsed = JSON.parse(res.stdout);
		expect(parsed.board[0].id).toBe("todo");
		expect(parsed.board[0].stories[0].id).toBe("US-001");
		expect(parsed.board[2].id).toBe("in_review");
		expect(parsed.board[2].stories[0].id).toBe("US-002");
	});

	it("moves a story between board columns and preserves profileCommand", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-move-"));
		const inPath = join(root, "prd.json");
		const outPath = join(root, "prd.moved.json");
		await writeFile(
			inPath,
			JSON.stringify({
				project: "NOOA",
				branchName: "feature/backlog-move",
				description: "Move story",
				userStories: [
					{
						id: "US-001",
						title: "In progress story",
						description: "Implementation work",
						acceptanceCriteria: ["AC-1"],
						profileCommand: ["node", "scripts/profile-api.js"],
						priority: 1,
						passes: false,
						state: "implementing",
					},
				],
			}),
		);

		const res = await execa(
			bunPath,
			[
				binPath,
				"backlog",
				"move",
				"--in",
				inPath,
				"--out",
				outPath,
				"--story",
				"US-001",
				"--to",
				"in_review",
				"--json",
			],
			{
				reject: false,
				env: baseEnv,
				cwd: repoRoot,
			},
		);

		expect(res.exitCode).toBe(0);
		const persisted = JSON.parse(await readFile(outPath, "utf8"));
		expect(persisted.userStories[0]?.state).toBe("peer_review_1");
		expect(persisted.userStories[0]?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
	});

	it("rejects invalid move target columns", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-move-invalid-"));
		const inPath = join(root, "prd.json");
		await writeFile(
			inPath,
			JSON.stringify({
				project: "NOOA",
				branchName: "feature/backlog-move-invalid",
				description: "Move story",
				userStories: [
					{
						id: "US-001",
						title: "Story",
						description: "Implementation work",
						acceptanceCriteria: ["AC-1"],
						priority: 1,
						passes: false,
						state: "implementing",
					},
				],
			}),
		);

		const res = await execa(
			bunPath,
			[
				binPath,
				"backlog",
				"move",
				"--in",
				inPath,
				"--story",
				"US-001",
				"--to",
				"review",
			],
			{
				reject: false,
				env: baseEnv,
				cwd: repoRoot,
			},
		);

		expect(res.exitCode).toBe(1);
		expect(res.stderr).toContain(
			"--to must be one of: todo, in_progress, in_review, done",
		);
	});
});
