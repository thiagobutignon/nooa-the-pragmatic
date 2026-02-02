import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

function expectZeroExit(
	result: { exitCode: number; stdout: string; stderr: string },
	label: string,
) {
	if (result.exitCode !== 0) {
		throw new Error(
			`${label} exit ${result.exitCode}\nstdout:\n${result.stdout.trim()}\nstderr:\n${result.stderr.trim()}`,
		);
	}
}

const historyEntries = [
	{
		id: "hist-1",
		prompt: "review",
		suite: "standard",
		command: "run",
		totalScore: 0.92,
		timestamp: "2026-02-02T10:00:00.000Z",
	},
	{
		id: "hist-2",
		prompt: "review",
		suite: "standard",
		command: "run",
		totalScore: 0.96,
		timestamp: "2026-02-02T12:00:00.000Z",
	},
	{
		id: "hist-3",
		prompt: "code",
		suite: "smoke",
		command: "apply",
		totalScore: 1,
		timestamp: "2026-02-02T14:00:00.000Z",
	},
];
const historyData = JSON.stringify(historyEntries);

describe("nooa eval CLI extensions", () => {
	it("help lists report/history/compare", async () => {
		const res = await execa(bunPath, [binPath, "eval", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});

		expectZeroExit(res, "help");
		expect(res.stdout).toContain("run");
		expect(res.stdout).toContain("report");
		expect(res.stdout).toContain("history");
		expect(res.stdout).toContain("compare");
	});

	it("history prints matching entries", async () => {
		const res = await execa(
			bunPath,
			[binPath, "eval", "history", "review", "--suite", "standard"],
			{
				reject: false,
				env: { ...baseEnv, NOOA_EVAL_HISTORY_DATA: historyData },
				cwd: repoRoot,
			},
		);

		expectZeroExit(res, "history");
		expect(res.stdout).toContain("History for review (suite: standard):");
		expect(res.stdout).toContain("[hist-1]");
		expect(res.stdout).toContain("[hist-2]");
	});

	it("report returns the latest entry", async () => {
		const res = await execa(
			bunPath,
			[binPath, "eval", "report", "review", "--suite", "standard"],
			{
				reject: false,
				env: { ...baseEnv, NOOA_EVAL_HISTORY_DATA: historyData },
				cwd: repoRoot,
			},
		);

		expectZeroExit(res, "report");
		expect(res.stdout).toContain("Report for review");
		expect(res.stdout).toContain("Score:");
		expect(res.stdout).toContain("(suite: standard)");
	});

	it("compare shows score delta between entries", async () => {
		const res = await execa(
			bunPath,
			[binPath, "eval", "compare", "review", "--suite", "standard"],
			{
				reject: false,
				env: { ...baseEnv, NOOA_EVAL_HISTORY_DATA: historyData },
				cwd: repoRoot,
			},
		);

		expectZeroExit(res, "compare");
		expect(res.stdout).toContain("Score delta");
		expect(res.stdout).toContain("hist-1");
		expect(res.stdout).toContain("hist-2");
	});
});
