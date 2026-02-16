import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
    createWorktree,
    listWorktrees,
    removeWorktree,
    pruneWorktrees,
    lockWorktree,
    worktreeInfo
} from "../../../src/features/worktree/execute";

// Mock dependencies
const mockGit = mock(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
mock.module("../../../src/features/worktree/git", () => ({
    git: mockGit
}));

const mockExeca = mock(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
mock.module("execa", () => ({
    execa: mockExeca
}));

mock.module("node:fs/promises", () => ({
    mkdir: async () => { },
    readFile: async () => "",
    writeFile: async () => { },
}));

const mockExistsSync = mock((path: string) => {
    if (path.includes("package.json")) return true;
    if (path.endsWith(".worktrees")) return true;
    if (path.endsWith("new-branch")) return false; // Target for create
    return true; // Default root/other dirs exist
});

mock.module("node:fs", () => ({
    existsSync: mockExistsSync
}));

describe("worktree execute unit tests", () => {
    beforeEach(() => {
        mockGit.mockClear();
        mockExeca.mockClear();
        mockExistsSync.mockClear();

        mockGit.mockImplementation(async (args) => {
            if (args[0] === "rev-parse") return { exitCode: 0, stdout: "/root", stderr: "" };
            if (args[0] === "check-ref-format") return { exitCode: 0, stdout: "", stderr: "" };
            if (args[0] === "show-ref") return { exitCode: 0, stdout: "", stderr: "" };
            if (args[0] === "check-ignore") return { exitCode: 0, stdout: "", stderr: "" };
            if (args[0] === "worktree" && args[1] === "add") return { exitCode: 0, stdout: "", stderr: "" };
            if (args[0] === "worktree" && args[1] === "list") return {
                exitCode: 0,
                stdout: "/root/.worktrees/feat/test  [feat/test]\n/root/.worktrees/locked  [locked] locked",
                stderr: ""
            };
            return { exitCode: 0, stdout: "", stderr: "" };
        });
    });

    describe("createWorktree", () => {
        it("should create worktree successfully", async () => {
            const result = await createWorktree({ branch: "new-branch" });
            expect(result.branch).toBe("new-branch");
            // Trace calls?
            // git: rev-parse, check-ref-format, show-ref (base), prune, check-ignore, show-ref (branch), add
            // execa: install, test
            expect(mockGit).toHaveBeenCalled();
            expect(mockExeca).toHaveBeenCalled();
        });

        it("should fail if branch is missing", async () => {
            try {
                await createWorktree({});
                expect(true).toBe(false); // Should fail
            } catch (e: any) {
                expect(e.message).toContain("Branch name is required");
            }
        });

        it("should fail if invalid branch name", async () => {
            mockGit.mockImplementation(async (args) => {
                if (args[0] === "rev-parse") return { exitCode: 0, stdout: "/root" };
                if (args[0] === "check-ref-format") return { exitCode: 1, stdout: "" }; // Fail
                return { exitCode: 0, stdout: "" };
            });

            try {
                await createWorktree({ branch: "invalid space" });
                expect(true).toBe(false);
            } catch (e: any) {
                expect(e.message).toContain("Invalid branch name");
            }
        });

    });

    describe("listWorktrees", () => {
        it("should list entries", async () => {
            const result = await listWorktrees({});
            expect(result.entries).toHaveLength(2);
            expect(result.entries[0].branch).toBe("feat/test");
            expect(result.entries[1].status).toBe("locked");
        });

        it("should handle git failure", async () => {
            mockGit.mockImplementation(async (args) => {
                if (args[0] === "rev-parse") return { exitCode: 0, stdout: "/root" };
                if (args[0] === "worktree" && args[1] === "list") return { exitCode: 1, stderr: "Failed" };
                return { exitCode: 0 };
            });

            try {
                await listWorktrees({});
                fail("Should have thrown");
            } catch (e: any) {
                expect(e.message).toContain("Failed");
            }
        });
    });

    describe("worktreeInfo", () => {
        it("should return info for existing branch", async () => {
            const result = await worktreeInfo({ branch: "feat/test" });
            expect(result.entry.branch).toBe("feat/test");
        });

        it("should fail if branch missing in input", async () => {
            try { await worktreeInfo({}); fail(); }
            catch (e: any) { expect(e.message).toContain("required"); }
        });

        it("should fail if worktree not found", async () => {
            try { await worktreeInfo({ branch: "missing" }); fail(); }
            catch (e: any) { expect(e.message).toContain("not found"); }
        });
    });

    describe("removeWorktree", () => {
        it("should remove existing worktree", async () => {
            mockGit.mockImplementation(async (args) => {
                if (args[0] === "rev-parse") return { exitCode: 0, stdout: "/root" };
                if (args[0] === "worktree" && args[1] === "remove") return { exitCode: 0, stdout: "" };
                return { exitCode: 0 };
            });

            const result = await removeWorktree({ branch: "existing" });
            expect(result.path).toContain("existing");
        });

        // Test failure cases...
    });

    describe("pruneWorktrees", () => {
        it("should prune", async () => {
            const result = await pruneWorktrees({});
            expect(result.traceId).toBeDefined();
        });
    });

    describe("lockWorktree", () => {
        it("should lock", async () => {
            const result = await lockWorktree({ branch: "feat/test", lock: true });
            expect(result.lock).toBe(true);
        });

        it("should unlocking", async () => {
            const result = await lockWorktree({ branch: "feat/test", lock: false });
            expect(result.lock).toBe(false);
        });
    });
});
