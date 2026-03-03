import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	createWorktree,
	listWorktrees,
	lockWorktree,
	pruneWorktrees,
	removeWorktree,
	worktreeInfo,
} from "../../../src/features/worktree/execute";

// Mock dependencies
const mockGit = mock(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
mock.module("../../../src/features/worktree/git", () => ({
	git: mockGit,
}));

mock.module("node:fs/promises", () => ({
	mkdir: async () => {},
	readFile: async () => "",
	writeFile: async () => {},
}));

const mockExistsSync = mock((path: string) => {
	if (path.includes("package.json")) return true;
	if (path.endsWith(".worktrees")) return true;
	if (path.endsWith("new-branch")) return false; // Target for create
	return true; // Default root/other dirs exist
});

mock.module("node:fs", () => ({
	existsSync: mockExistsSync,
}));

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

describe("worktree execute unit tests", () => {
	beforeEach(() => {
		mockGit.mockClear();
		mockExistsSync.mockClear();

		mockGit.mockImplementation(async (args) => {
			if (args[0] === "rev-parse")
				return { exitCode: 0, stdout: "/root", stderr: "" };
			if (args[0] === "check-ref-format")
				return { exitCode: 0, stdout: "", stderr: "" };
			if (args[0] === "show-ref")
				return { exitCode: 0, stdout: "", stderr: "" };
			if (args[0] === "check-ignore")
				return { exitCode: 0, stdout: "", stderr: "" };
			if (args[0] === "worktree" && args[1] === "add")
				return { exitCode: 0, stdout: "", stderr: "" };
			if (args[0] === "worktree" && args[1] === "list")
				return {
					exitCode: 0,
					stdout:
						"/root/.worktrees/feat/test  [feat/test]\n/root/.worktrees/locked  [locked] locked",
					stderr: "",
				};
			return { exitCode: 0, stdout: "", stderr: "" };
		});
	});

	describe("createWorktree", () => {
		it("should create worktree successfully", async () => {
			const result = await createWorktree({
				branch: "new-branch",
				noInstall: true,
				noTest: true,
			});
			expect(result.branch).toBe("new-branch");
			expect(result.skipInstall).toBe(true);
			expect(result.skipTest).toBe(true);
			expect(mockGit).toHaveBeenCalled();
		});

		it("should fail if branch is missing", async () => {
			try {
				await createWorktree({});
				expect(true).toBe(false); // Should fail
			} catch (error: unknown) {
				expect(getErrorMessage(error)).toContain("Branch name is required");
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
			} catch (error: unknown) {
				expect(getErrorMessage(error)).toContain("Invalid branch name");
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
				if (args[0] === "worktree" && args[1] === "list")
					return { exitCode: 1, stderr: "Failed" };
				return { exitCode: 0 };
			});

			try {
				await listWorktrees({});
				fail("Should have thrown");
			} catch (error: unknown) {
				expect(getErrorMessage(error)).toContain("Failed");
			}
		});
	});

	describe("worktreeInfo", () => {
		it("should return info for existing branch", async () => {
			const result = await worktreeInfo({ branch: "feat/test" });
			expect(result.entry.branch).toBe("feat/test");
		});

		it("should fail if branch missing in input", async () => {
			try {
				await worktreeInfo({});
				fail();
			} catch (error: unknown) {
				expect(getErrorMessage(error)).toContain("required");
			}
		});

		it("should fail if worktree not found", async () => {
			try {
				await worktreeInfo({ branch: "missing" });
				fail();
			} catch (error: unknown) {
				expect(getErrorMessage(error)).toContain("not found");
			}
		});
	});

	describe("removeWorktree", () => {
		it("should remove existing worktree", async () => {
			mockGit.mockImplementation(async (args) => {
				if (args[0] === "rev-parse") return { exitCode: 0, stdout: "/root" };
				if (args[0] === "worktree" && args[1] === "remove")
					return { exitCode: 0, stdout: "" };
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
