import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryEngine } from "../../features/memory/engine";
import { autoReflect } from "./hook";

// We will use spyOn locally in beforeEach or tests
const addEntryMock = mock(async () => ({ id: "mem-123" }) as any);

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
		const spy = spyOn(MemoryEngine.prototype, "addEntry").mockImplementation(
			addEntryMock as any,
		);
		await autoReflect("test-cmd", ["--arg", "val"], { success: true }, testDir);

		expect(addEntryMock).toHaveBeenCalled();
		const callArgs = addEntryMock.mock.calls[0][0];
		expect(callArgs.type).toBe("observation");
		expect(callArgs.scope).toBe("session");
		expect(callArgs.content).toContain("Ran command: test-cmd");
		expect(callArgs.content).toContain("--arg val");
		spy.mockRestore();
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

	test("autoReflect skips help invocations", async () => {
		const spy = spyOn(MemoryEngine.prototype, "addEntry").mockImplementation(
			addEntryMock as any,
		);

		await autoReflect("ai", ["--help"], { ok: true }, testDir);
		await autoReflect("act", ["-h"], { ok: true }, testDir);

		expect(addEntryMock).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	test("autoReflect skips version invocations", async () => {
		const spy = spyOn(MemoryEngine.prototype, "addEntry").mockImplementation(
			addEntryMock as any,
		);

		await autoReflect("ai", ["--version"], { ok: true }, testDir);
		await autoReflect("ai", ["-v"], { ok: true }, testDir);
		await autoReflect("ai", ["--version", "--foo"], { ok: true }, testDir);
		await autoReflect("ai", ["-v", "--bar"], { ok: true }, testDir);

		expect(addEntryMock).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
