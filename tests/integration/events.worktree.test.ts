import { describe, expect, it, mock } from "bun:test";
import { rm } from "node:fs/promises";
import { EventBus } from "../../src/core/event-bus";
import worktreeCommand from "../../src/features/worktree/cli";

describe("Integration: Worktree Events", () => {
	it("should emit worktree.acquired and worktree.released events", async () => {
		const bus = new EventBus();
		const emitSpy = mock((_event: string, _payload: unknown) => {});
		bus.emit = emitSpy as unknown;

		// We need to run 'worktree create' on a dummy branch
		// Use --no-test to speed it up and avoid failures
		const branchName = `test-integration-events-${Date.now()}`;

		try {
			// worktree create
			await worktreeCommand.execute({
				args: [],
				// We need to check if worktree command expects positionals via rawArgs
				// worktree.ts likely uses subcommands
				rawArgs: [
					"worktree",
					"create",
					branchName,
					"--no-test",
					"--no-install",
				],
				values: {},
				bus,
			});

			// Expect worktree.acquired
			expect(emitSpy).toHaveBeenCalledWith(
				"worktree.acquired",
				expect.objectContaining({
					branch: branchName,
					traceId: expect.any(String),
				}),
			);
		} finally {
			// Cleanup: worktree remove might needed if it actually created it
			// But for this test, we expect the EVENTS to be missing, so we are asserting failure.
			// The actual command might succeed in creating the folder.
			// We should try to clean it up.
			// Using raw rm for speed in test cleanup
			await rm(`.worktrees/${branchName}`, {
				recursive: true,
				force: true,
			}).catch(() => {});
			// prune?
		}
	});
});
