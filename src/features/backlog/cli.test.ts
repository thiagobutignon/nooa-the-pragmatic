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
});
