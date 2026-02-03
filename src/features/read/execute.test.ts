import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EventBus } from "../../core/event-bus";
import readCommand from "./cli";

const TEST_DIR = join(import.meta.dir, "tmp-test-read");
type ReadValues = { help?: boolean; json?: boolean };

describe("read command", () => {
	let bus: EventBus;

	beforeEach(async () => {
		bus = new EventBus();
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	test("help: displays help", async () => {
		let output = "";
		const logSpy = spyOn(console, "log").mockImplementation((msg: string) => {
			output = msg;
		});

		await readCommand.execute({
			args: ["read"],
			rawArgs: ["read", "--help"],
			values: { help: true } as ReadValues,
			bus,
		});
		expect(output).toContain("Usage: nooa read");
		logSpy.mockRestore();
	});

	test("failure: missing path and TTY", async () => {
		let errorLogged = false;
		const errSpy = spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("Path is required")) errorLogged = true;
		});

		// Mock TTY
		const stdin = process.stdin as NodeJS.ReadStream & { isTTY: boolean };
		const originalTTY = stdin.isTTY;
		stdin.isTTY = true;

		await readCommand.execute({
			args: ["read"],
			rawArgs: ["read"],
			values: {} as ReadValues,
			bus,
		});

		stdin.isTTY = originalTTY;
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(2);
		process.exitCode = 0;
		errSpy.mockRestore();
	});

	test("success: read path from stdin", async () => {
		const filePath = join(TEST_DIR, "stdin_path.txt");
		await writeFile(filePath, "stdin content");

		const { runWithStdin } = await import("../../core/io");

		let output = "";
		const writeSpy = spyOn(process.stdout, "write").mockImplementation(
			(data: string | Uint8Array) => {
				output += data.toString();
				return true;
			},
		);

		await runWithStdin(filePath, () =>
			readCommand.execute({
				args: ["read"],
				rawArgs: ["read"],
				values: {} as ReadValues,
				bus,
			}),
		);

		expect(output).toBe("stdin content");
		writeSpy.mockRestore();
	});

	test("success: json output", async () => {
		const filePath = join(TEST_DIR, "test.json");
		await writeFile(filePath, "test content");

		let output = "";
		const logSpy = spyOn(console, "log").mockImplementation((msg: string) => {
			output = msg;
		});

		await readCommand.execute({
			args: ["read", filePath],
			rawArgs: ["read", filePath, "--json"],
			values: { json: true } as ReadValues,
			bus,
		});

		const parsed = JSON.parse(output);
		expect(parsed.path).toBe(filePath);
		expect(parsed.content).toBe("test content");
		expect(parsed.bytes).toBe(12);
		logSpy.mockRestore();
	});

	test("error handling: file not found", async () => {
		let errorLogged = false;
		const errSpy = spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("File not found")) errorLogged = true;
		});

		await readCommand.execute({
			args: ["read", "nonexistent.txt"],
			rawArgs: ["read", "nonexistent.txt"],
			values: {} as ReadValues,
			bus,
		});
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(1);
		process.exitCode = 0;
		errSpy.mockRestore();
	});

	test("error handling: other error", async () => {
		let errorLogged = false;
		const errSpy = spyOn(console, "error").mockImplementation((msg: string) => {
			if (msg.includes("Error: ")) errorLogged = true;
		});

		// Try to read a directory as a file which should throw an error on some systems or different error message
		await readCommand.execute({
			args: ["read", TEST_DIR],
			rawArgs: ["read", TEST_DIR],
			values: {} as ReadValues,
			bus,
		});
		expect(errorLogged).toBe(true);
		expect(process.exitCode).toBe(1);
		process.exitCode = 0;
		errSpy.mockRestore();
	});
});
