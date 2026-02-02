import { describe, expect, mock, test } from "bun:test";
import { executeDiff } from "./diff";

describe("Code Diff Feature", () => {
	test("executeDiff returns diff output", async () => {
		const exec = mock(async () => ({
			stdout: "diff --git a/foo b/foo\n+line",
		}));
		const diff = await executeDiff(undefined, exec);
		expect(diff).toContain("diff --git");
		expect(diff).toContain("+line");
	});

	test("executeDiff passes arguments to git diff", async () => {
		let captured: { cmd: string; args: string[] } | null = null;
		const exec = mock(async (cmd: string, args: string[]) => {
			captured = { cmd, args };
			return { stdout: "" };
		});
		const diff = await executeDiff("src", exec);
		expect(diff).toBeDefined();
		expect(captured).toEqual({ cmd: "git", args: ["diff", "src"] });
	});
});
