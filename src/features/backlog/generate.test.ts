import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";
import { generateBacklogFromPrompt } from "./generate";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("backlog generate", () => {
	it("generates a Ralph-compatible PRD payload from a macro prompt", async () => {
		const result = await generateBacklogFromPrompt({
			prompt: "Criar landing page educacional do Ralph Loop em HTML/CSS/JS",
		});

		expect(result.project.length).toBeGreaterThan(0);
		expect(result.branchName.length).toBeGreaterThan(0);
		expect(result.description.length).toBeGreaterThan(0);
		expect(result.userStories.length).toBeGreaterThan(0);
		expect(result.userStories[0]?.id).toMatch(/^US-\d{3}$/);
		expect(result.userStories[0]?.title.length).toBeGreaterThan(0);
		expect(result.userStories[0]?.description.length).toBeGreaterThan(0);
		expect(result.userStories[0]?.acceptanceCriteria.length).toBeGreaterThan(0);
		expect(result.userStories[0]?.priority).toBe(1);
		expect(result.userStories[0]?.passes).toBe(false);
		expect(result.userStories[0]?.state).toBe("pending");
	});

	it("writes generated PRD to disk via CLI --out", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-generate-"));
		const outPath = join(root, "prd.json");

		const res = await execa(
			bunPath,
			[
				binPath,
				"backlog",
				"generate",
				"Criar landing do Ralph Loop",
				"--out",
				outPath,
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
		expect(Array.isArray(persisted.userStories)).toBe(true);
		expect(persisted.userStories[0]?.state).toBe("pending");
	});

	it("can seed generated stories with an explicit profileCommand", async () => {
		const result = await generateBacklogFromPrompt({
			prompt: "Improve API latency",
			profileCommand: ["node", "scripts/profile-api.js"],
		});

		expect(result.userStories[0]?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
	});

	it("writes a generated profileCommand via CLI", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-backlog-generate-profile-"));
		const outPath = join(root, "prd.json");

		const res = await execa(
			bunPath,
			[
				binPath,
				"backlog",
				"generate",
				"Improve API latency",
				"--profile-command",
				'["node","scripts/profile-api.js"]',
				"--out",
				outPath,
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
		expect(persisted.userStories[0]?.profileCommand).toEqual([
			"node",
			"scripts/profile-api.js",
		]);
	});
});
