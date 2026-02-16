import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import indexCommand, { indexBuilder, run } from "./cli";
import * as execute from "./execute";

describe("Index CLI", () => {
	let consoleLogSpy: unknown;
	let consoleErrorSpy: unknown;
	let exitCode: unknown;
	const mockBus = { emit: () => {} } as unknown;

	beforeEach(() => {
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		exitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		process.exitCode = exitCode;
	});

	describe("run() handler", () => {
		test("calls indexRepo when action is repo", async () => {
			const spy = spyOn(execute, "indexRepo").mockResolvedValue({
				files: 5,
				totalChunks: 10,
				traceId: "test-trace",
			});

			const result = await run({ action: "repo" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.mode).toBe("repo");
			}
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});

		test("calls indexFile when action is file and path provided", async () => {
			const spy = spyOn(execute, "indexFile").mockResolvedValue({
				chunks: 3,
				path: "test.ts",
			});
			const result = await run({ action: "file", path: "test.ts" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.mode).toBe("file");
			}
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});

		test("returns error when action is file but path missing", async () => {
			const result = await run({ action: "file" });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("index.missing_path");
			}
		});

		test("calls clearIndex when action is clear", async () => {
			const spy = spyOn(execute, "clearIndex").mockResolvedValue(
				undefined as unknown,
			);
			const result = await run({ action: "clear" });
			expect(result.ok).toBe(true);
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});

		test("calls getIndexStats when action is stats", async () => {
			const spy = spyOn(execute, "getIndexStats").mockResolvedValue({
				documents: 1,
				chunks: 2,
			});
			const result = await run({ action: "stats" });
			expect(result.ok).toBe(true);
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});

		test("calls rebuildIndex when action is rebuild", async () => {
			const spy = spyOn(execute, "rebuildIndex").mockResolvedValue({
				totalChunks: 5,
				files: 2,
				traceId: "abc",
			});
			const result = await run({ action: "rebuild" });
			expect(result.ok).toBe(true);
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});

		test("returns error when action is unknown", async () => {
			const result = await run({ action: "unknown" });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("index.missing_command");
			}
		});

		test("returns error when action is missing", async () => {
			const result = await run({});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("index.missing_command");
			}
		});

		test("returns runtime_error when operation throws", async () => {
			const spy = spyOn(execute, "indexRepo").mockRejectedValue(
				new Error("Foo"),
			);
			const result = await run({ action: "repo" });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("index.runtime_error");
			}
			spy.mockRestore();
		});
	});

	describe("Command Execution (onSuccess/onFailure)", () => {
		test("executes repo command and prints output", async () => {
			const spy = spyOn(execute, "indexRepo").mockResolvedValue({
				files: 2,
				totalChunks: 5,
				traceId: "abc",
			});

			await indexCommand.execute({
				rawArgs: ["index", "repo"],
				bus: mockBus,
			} as unknown);

			expect(spy).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Indexing repository"),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Files: 2"),
			);
			spy.mockRestore();
		});

		test("executes file command and prints output", async () => {
			const spy = spyOn(execute, "indexFile").mockResolvedValue({
				chunks: 3,
				path: "foo.ts",
			});

			await indexCommand.execute({
				rawArgs: ["index", "file", "foo.ts"],
				bus: mockBus,
			} as unknown);

			expect(spy).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Indexed foo.ts"),
			);
			spy.mockRestore();
		});

		test("executes clear command and prints output", async () => {
			const spy = spyOn(execute, "clearIndex").mockResolvedValue(
				undefined as unknown,
			);

			await indexCommand.execute({
				rawArgs: ["index", "clear"],
				bus: mockBus,
			} as unknown);

			expect(spy).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Index cleared"),
			);
			spy.mockRestore();
		});

		test("executes stats command and prints output", async () => {
			const spy = spyOn(execute, "getIndexStats").mockResolvedValue({
				documents: 10,
				chunks: 20,
			});

			await indexCommand.execute({
				rawArgs: ["index", "stats"],
				bus: mockBus,
			} as unknown);

			expect(spy).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Index Stats"),
			);
			spy.mockRestore();
		});

		test("executes rebuild command and prints output", async () => {
			const spy = spyOn(execute, "rebuildIndex").mockResolvedValue({
				totalChunks: 10,
				files: 5,
				traceId: "abc",
			});

			await indexCommand.execute({
				rawArgs: ["index", "rebuild"],
				bus: mockBus,
			} as unknown);

			expect(spy).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Rebuilding index"),
			);
			spy.mockRestore();
		});

		test("handles --json output", async () => {
			const spy = spyOn(execute, "getIndexStats").mockResolvedValue({
				documents: 10,
				chunks: 20,
			});

			await indexCommand.execute({
				rawArgs: ["index", "stats", "--json"],
				bus: mockBus,
			} as unknown);

			expect(spy).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('"documents": 10'),
			);
			spy.mockRestore();
		});

		test("handles missing command error", async () => {
			await indexCommand.execute({
				rawArgs: ["index"],
				bus: mockBus,
			} as unknown);

			// Should print help
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Usage: nooa index"),
			);
			expect(process.exitCode).toBe(2);
		});

		test("handles missing path error", async () => {
			await indexCommand.execute({
				rawArgs: ["index", "file"],
				bus: mockBus,
			} as unknown);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("File path required"),
			);
			expect(process.exitCode).toBe(2);
		});

		test("handles generic error via runtime_error", async () => {
			// Instead of mocking run, we mock the underlying execution to throw
			const spy = spyOn(execute, "indexRepo").mockRejectedValue(
				new Error("Boom"),
			);

			await indexCommand.execute({
				rawArgs: ["index", "repo"],
				bus: mockBus,
			} as unknown);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Index operation failed"),
			);
			// It returns exit code 1 because index.runtime_error isn't explicitly handled in onFailure
			// so it falls to handleCommandError -> console.error and exit 1
			expect(process.exitCode).toBe(1);

			spy.mockRestore();
		});

		test("handles unknown success mode (default case)", async () => {
			// Use builder to create a command with a mock run that returns unknown mode
			const mockRun = async () => ({
				ok: true,
				data: { mode: "unknown", result: {} },
			});

			// We cast to any because we are injecting a weird run function compatible signature-wise
			const testCommand = indexBuilder.run(mockRun as unknown).build();

			await testCommand.execute({
				rawArgs: ["index", "repo"],
				bus: mockBus,
			} as unknown);

			// Should just break and do nothing (no logs for unknown mode)
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});
	});
});
