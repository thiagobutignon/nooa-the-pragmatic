import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as execaModule from "execa";
import { AiEngine } from "../ai/engine";
import * as goalExecute from "../goal/execute";
import * as indexExecute from "../index/execute";
import { executeFix, runFix } from "./execute";

describe("executeFix", () => {
	let originalProvider: string | undefined;

	beforeEach(() => {
		originalProvider = process.env.NOOA_AI_PROVIDER;
		process.env.NOOA_AI_PROVIDER = "mock";
	});

	afterEach(() => {
		if (originalProvider) {
			process.env.NOOA_AI_PROVIDER = originalProvider;
		} else {
			delete process.env.NOOA_AI_PROVIDER;
		}
	});

	it("should track telemetry and return ok in dry run", async () => {
		const { result, traceId } = await executeFix({
			issue: "test issue",
			dryRun: true,
		});

		expect(traceId).toBeDefined();
		expect(result.ok).toBe(true);
	});

	it("should carry out full fix loop (Stage 1-5)", async () => {
		// Mock all dependencies
		const execaSpy = spyOn(execaModule, "execa").mockResolvedValue({
			exitCode: 0,
		} as unknown);
		const searchSpy = spyOn(indexExecute, "executeSearch").mockResolvedValue([
			{ path: "src/file.ts", chunk: "chunk content", score: 0.9 },
		]);
		const goalSpy = spyOn(goalExecute, "getGoal").mockResolvedValue(
			"Test Goal",
		);
		const aiSpy = spyOn(AiEngine.prototype, "complete").mockResolvedValue({
			content: "Fix applied",
			model: "mock-model",
			provider: "mock",
		} as unknown);

		const result = await runFix({ issue: "broken test", dryRun: false });

		expect(result.ok).toBe(true);
		expect(result.stages.worktree).toBe(true);
		expect(result.stages.context).toBe(true);
		expect(result.stages.patch).toBe(true);
		expect(result.stages.verify).toBe(true);
		expect(result.stages.commit).toBe(true);

		// Verify calls
		expect(searchSpy).toHaveBeenCalledWith("broken test", 3);
		expect(aiSpy).toHaveBeenCalled();
		expect(execaSpy).toHaveBeenCalledWith(
			"bun",
			["index.ts", "worktree", "create", "fix/broken-test"],
			expect.anything(),
		);

		execaSpy.mockRestore();
		searchSpy.mockRestore();
		goalSpy.mockRestore();
		aiSpy.mockRestore();
	});

	it("should handle failures in stages", async () => {
		const execaSpy = spyOn(execaModule, "execa").mockResolvedValue({
			exitCode: 1,
			stderr: "Worktree error",
		} as unknown);

		const result = await runFix({ issue: "worktree fail", dryRun: false });

		expect(result.ok).toBe(false);
		expect(result.error).toContain("Failed to create worktree: Worktree error");
		expect(result.stages.worktree).toBe(false);

		execaSpy.mockRestore();
	});

	it("should handle error when goal or search fails", async () => {
		const execaSpy = spyOn(execaModule, "execa").mockResolvedValue({
			exitCode: 0,
		} as unknown);
		const goalSpy = spyOn(goalExecute, "getGoal").mockRejectedValue(
			new Error("Database error"),
		);

		const result = await runFix({ issue: "fatal", dryRun: false });

		expect(result.ok).toBe(false);
		expect(result.error).toBe("Database error");

		execaSpy.mockRestore();
		goalSpy.mockRestore();
	});
});
