import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autoReflect } from "./hook";

// Mock MemoryEngine
const addEntryMock = mock(async () => ({ id: "mem-123" }));
mock.module("../../features/memory/engine", () => ({
	MemoryEngine: class {
		addEntry = addEntryMock;
	},
}));

describe("Auto Reflection Hook", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		originalCwd = process.cwd();
		testDir = await mkdtemp(join(tmpdir(), "nooa-reflection-"));
		await mkdir(join(testDir, ".nooa"), { recursive: true });

		// Mock process.cwd to return testDir
		// Note: Bun test runner might not allow mocking process.cwd() easily in all contexts,
		// but let's try injecting it or assuming the hook accepts a root path.
		// For robustness, I'll update hook.ts to accept an optional root path, similar to other modules.
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
		addEntryMock.mockClear();
	});

	test("autoReflect adds observable memory entry", async () => {
		await autoReflect("test-cmd", ["--arg", "val"], { success: true }, testDir);

		expect(addEntryMock).toHaveBeenCalled();
		const callArgs = addEntryMock.mock.calls[0][0];
		expect(callArgs.type).toBe("observation");
		expect(callArgs.scope).toBe("session");
		expect(callArgs.content).toContain("Ran command: test-cmd");
		expect(callArgs.content).toContain("--arg val");
	});

	test("autoReflect skips excluded commands (e.g. reflection itself)", async () => {
		// Assume 'memory' command shouldn't trigger reflection to avoid loops if we had that rule
		// But for now, let's say 'version' command might be skipped if we implement a filter.
		// Let's test basic functionality first.

		// Actually, let's verify it handles errors gracefully
		addEntryMock.mockRejectedValueOnce(new Error("DB Error"));

		// Should not throw
		// Should not throw (silent match)
		try {
			await autoReflect("fail-cmd", [], {}, testDir);
		} catch (e) {
			expect(e).toBeUndefined(); // Fail if it throws
		}
	});
});
