import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EventBus } from "../../core/event-bus";
import codeCommand from "./cli";

const TEST_DIR = join(import.meta.dir, "tmp-test-code");

describe("code command execute", () => {
	let bus: EventBus;

	beforeEach(async () => {
		bus = new EventBus();
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	test("write: failure - missing path", async () => {
		const context = {
			args: ["code", "write"],
			rawArgs: ["code", "write"],
			values: {} as any,
			bus,
		};

		let errorLogged = false;
		spyOn(console, "error").mockImplementation(() => {
			errorLogged = true;
		});

		await codeCommand.execute(context);

		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(2);
		process.exitCode = 0; // reset for Bun (undefined keeps previous exitCode)
	});

	test("write: success - basic write", async () => {
		const filePath = join(TEST_DIR, "test.txt");
		const context = {
			args: ["code", "write", filePath],
			rawArgs: [
				"code",
				"write",
				filePath,
				"--from",
				join(TEST_DIR, "input.txt"),
			],
			values: { from: join(TEST_DIR, "input.txt") } as any,
			bus,
		};

		await writeFile(join(TEST_DIR, "input.txt"), "hello world");
		await codeCommand.execute(context);

		const content = await readFile(filePath, "utf-8");
		expect(content).toBe("hello world");
	});

	test("write: failure - missing input", async () => {
		const filePath = join(TEST_DIR, "test.txt");
		const context = {
			args: ["code", "write", filePath],
			rawArgs: ["code", "write", filePath],
			values: {} as any, // no --from, and stdin is TTY in tests usually
			bus,
		};

		let errorLogged = false;
		spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("Missing input")) errorLogged = true;
		});

		await codeCommand.execute(context);
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(2);
		process.exitCode = 0;
	});

	test("write: dry-run", async () => {
		const filePath = join(TEST_DIR, "dry.txt");
		const context = {
			args: ["code", "write", filePath],
			rawArgs: [
				"code",
				"write",
				filePath,
				"--from",
				join(TEST_DIR, "in.txt"),
				"--dry-run",
			],
			values: { from: join(TEST_DIR, "in.txt"), "dry-run": true } as any,
			bus,
		};

		await writeFile(join(TEST_DIR, "in.txt"), "no change");
		await codeCommand.execute(context);

		const exists = await readFile(filePath)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(false);
	});

	test("write: json output", async () => {
		const filePath = join(TEST_DIR, "test.json");
		const context = {
			args: ["code", "write", filePath],
			rawArgs: [
				"code",
				"write",
				filePath,
				"--from",
				join(TEST_DIR, "in.txt"),
				"--json",
			],
			values: { from: join(TEST_DIR, "in.txt"), json: true } as any,
			bus,
		};

		await writeFile(join(TEST_DIR, "in.txt"), "json content");

		let output = "";
		spyOn(console, "log").mockImplementation((msg: string) => {
			output = msg;
		});

		await codeCommand.execute(context);

		const parsed = JSON.parse(output);
		expect(parsed.path).toContain("test.json");
		expect(parsed.mode).toBe("write");
	});

	test("patch: basic success", async () => {
		const filePath = join(TEST_DIR, "to_patch.txt");
		const patchPath = join(TEST_DIR, "fix.patch");
		await writeFile(filePath, "line 1\nline 2\n");
		await writeFile(
			patchPath,
			`--- a/to_patch.txt\n+++ b/to_patch.txt\n@@ -1,2 +1,2 @@\n-line 1\n+line one\n line 2\n`,
		);

		const context = {
			args: ["code", "write", filePath], // code write <path> --patch-from <path>
			rawArgs: ["code", "write", filePath, "--patch-from", patchPath],
			values: { "patch-from": patchPath } as any,
			bus,
		};

		await codeCommand.execute(context);

		const content = await readFile(filePath, "utf-8");
		expect(content).toBe("line one\nline 2\n");
	});

	test("patch subcommand: implies patch mode", async () => {
		const filePath = join(TEST_DIR, "to_patch_sub.txt");
		const patchPath = join(TEST_DIR, "sub.patch");
		await writeFile(filePath, "original\n");
		await writeFile(
			patchPath,
			`--- a/to_patch_sub.txt\n+++ b/to_patch_sub.txt\n@@ -1 +1 @@\n-original\n+subcommand\n`,
		);

		const context = {
			args: ["code", "patch", filePath],
			rawArgs: ["code", "patch", filePath, "--patch-from", patchPath],
			values: { "patch-from": patchPath } as any,
			bus,
		};

		await codeCommand.execute(context);

		const content = await readFile(filePath, "utf-8");
		expect(content).toBe("subcommand\n");
	});

	test("help: displays help and returns", async () => {
		const context = {
			args: ["code"],
			rawArgs: ["code", "--help"],
			values: { help: true } as any,
			bus,
		};

		let helpCalled = false;
		spyOn(console, "log").mockImplementation((msg: string) => {
			if (msg.includes("Usage: nooa code <subcommand>")) helpCalled = true;
		});

		await codeCommand.execute(context);
		expect(helpCalled).toBe(true);
	});

	test("error handling: patch exclusive with from", async () => {
		const context = {
			args: ["code", "write", "any.txt"],
			rawArgs: ["code", "write", "any.txt", "--patch", "--from", "some.txt"],
			values: { patch: true, from: "some.txt" } as any,
			bus,
		};

		let errorLogged = false;
		spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("mutually exclusive")) errorLogged = true;
		});

		await codeCommand.execute(context);
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(2);
		process.exitCode = 0;
	});

	test("patch: missing input error", async () => {
		const context = {
			args: ["code", "write", "target.txt"],
			rawArgs: ["code", "write", "target.txt", "--patch"],
			values: { patch: true } as any, // no --patch-from, and stdin is TTY
			bus,
		};

		let errorLogged = false;
		spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("Missing patch input")) errorLogged = true;
		});

		await codeCommand.execute(context);
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(2);
		process.exitCode = 0;
	});

	test("patch: json output", async () => {
		const filePath = join(TEST_DIR, "to_patch_json.txt");
		const patchPath = join(TEST_DIR, "fix_json.patch");
		await writeFile(filePath, "line 1\n");
		await writeFile(
			patchPath,
			`--- a/to_patch_json.txt\n+++ b/to_patch_json.txt\n@@ -1 +1 @@\n-line 1\n+line one\n`,
		);

		const context = {
			args: ["code", "write", filePath],
			rawArgs: ["code", "write", filePath, "--patch-from", patchPath, "--json"],
			values: { "patch-from": patchPath, json: true } as any,
			bus,
		};

		let output = "";
		spyOn(console, "log").mockImplementation((msg: string) => {
			output = msg;
		});

		await codeCommand.execute(context);

		const parsed = JSON.parse(output);
		expect(parsed.mode).toBe("patch");
		expect(parsed.patched).toBe(true);
	});

	test("write: from stdin", async () => {
		const filePath = join(TEST_DIR, "stdin_out.txt");
		const context = {
			args: ["code", "write", filePath],
			rawArgs: ["code", "write", filePath],
			values: {} as any,
			bus,
		};

		// Mock stdin
		const originalStdin = process.stdin;
		const mockStdin = {
			isTTY: false,
			[Symbol.asyncIterator]: async function* () {
				yield Buffer.from("stdin content");
			},
		} as any;
		Object.defineProperty(process, "stdin", {
			value: mockStdin,
			configurable: true,
		});

		await codeCommand.execute(context);

		Object.defineProperty(process, "stdin", {
			value: originalStdin,
			configurable: true,
		});

		const content = await readFile(filePath, "utf-8");
		expect(content).toBe("stdin content");
	});

	test("error handling: unexpected error", async () => {
		const context = {
			args: ["code", "write", TEST_DIR], // Writing to a directory should fail
			rawArgs: ["code", "write", TEST_DIR, "--from", join(TEST_DIR, "any.txt")],
			values: { from: join(TEST_DIR, "any.txt") } as any,
			bus,
		};
		await writeFile(join(TEST_DIR, "any.txt"), "x");

		let errorLogged = false;
		spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("Error:")) errorLogged = true;
		});

		await codeCommand.execute(context);
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(1);
		process.exitCode = 0;
	});

	test("unknown action: displays help", async () => {
		const context = {
			args: ["code", "unknown"],
			rawArgs: ["code", "unknown"],
			values: {} as any,
			bus,
		};

		let helpCalled = false;
		spyOn(console, "log").mockImplementation((msg: string) => {
			if (msg.includes("Usage: nooa code <subcommand>")) helpCalled = true;
		});

		await codeCommand.execute(context);
		expect(helpCalled).toBe(true);
	});
});
