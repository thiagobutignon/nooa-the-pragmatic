import { describe, expect, it, mock } from "bun:test";
import { run } from "../../../src/features/worktree/cli";

// Mock the execution logic
mock.module("../../../src/features/worktree/execute", () => ({
    createWorktree: async () => ({
        branch: "feat/test",
        base: "main",
        path: "/tmp/worktrees/feat/test",
        skipInstall: false,
        skipTest: false,
        durationMs: 100,
    }),
    listWorktrees: async () => ({
        entries: [{ branch: "feat/test" }],
        raw: "feat/test",
    }),
    removeWorktree: async () => ({
        path: "/tmp/worktrees/feat/test",
    }),
    pruneWorktrees: async () => { }, // void
    lockWorktree: async ({ lock }: { lock: boolean }) => ({
        path: "/tmp/worktrees/feat/test",
        locked: lock,
    }),
    worktreeInfo: async () => ({
        entry: {
            branch: "feat/test",
            path: "/tmp/worktrees/feat/test",
            status: "clean",
        },
    }),
    WorktreeError: class extends Error {
        exitCode: number;
        constructor(message: string, exitCode = 1) {
            super(message);
            this.exitCode = exitCode;
        }
    },
}));

describe("worktree CLI run()", () => {
    it("should handle create action", async () => {
        const result = await run({ action: "create", branch: "feat/test" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("create");
        expect(result.data?.branch).toBe("feat/test");
    });

    it("should handle list action", async () => {
        const result = await run({ action: "list" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("list");
        expect(result.data?.entries).toHaveLength(1);
    });

    it("should handle remove action", async () => {
        const result = await run({ action: "remove", branch: "feat/test" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("remove");
    });

    it("should handle prune action", async () => {
        const result = await run({ action: "prune" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("prune");
    });

    it("should handle lock action", async () => {
        const result = await run({ action: "lock", branch: "feat/test" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("lock");
    });

    it("should handle unlock action", async () => {
        const result = await run({ action: "unlock", branch: "feat/test" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("unlock");
    });

    it("should handle info action", async () => {
        const result = await run({ action: "info", branch: "feat/test" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("info");
        expect(result.data?.status).toBe("clean");
    });

    it("should handle missing action", async () => {
        const result = await run({});
        expect(result.ok).toBe(false);
        expect(result.error?.code).toBe("worktree.missing_action");
    });

    it("should handle help action", async () => {
        const result = await run({ action: "help" });
        expect(result.ok).toBe(true);
        expect(result.data?.mode).toBe("help");
    });
});
