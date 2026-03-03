import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
	handleScaffoldFailure,
	handleScaffoldSuccess,
	parseScaffoldInput,
	run,
} from "../../../src/features/scaffold/cli";

// Mock execute
const mockExecuteScaffold = mock(async () => ({
	results: ["file.ts"],
	traceId: "t1",
}));

mock.module("../../../src/features/scaffold/execute", () => ({
	executeScaffold: mockExecuteScaffold,
}));

describe("scaffold CLI", () => {
	beforeEach(() => {
		mockExecuteScaffold.mockClear();
	});

	describe("parseScaffoldInput", () => {
		it("should parse args", async () => {
			const result = await parseScaffoldInput({
				positionals: ["scaffold", "command", "my-feature"],
				values: { force: true, json: true },
			});
			expect(result.type).toBe("command");
			expect(result.name).toBe("my-feature");
			expect(result.force).toBe(true);
			expect(result.json).toBe(true);
		});
	});

	describe("run", () => {
		it("should validate missing args", async () => {
			const result = await run({});
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("scaffold.invalid_args");
		});

		it("should validate type", async () => {
			const result = await run({
				type: "invalid" as unknown as "command",
				name: "foo",
			});
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("scaffold.invalid_type");
		});

		it("should execute success", async () => {
			const result = await run({ type: "command", name: "foo" });
			expect(result.ok).toBe(true);
			expect(result.data?.files).toEqual(["file.ts"]);
		});

		it("should handle already exists", async () => {
			mockExecuteScaffold.mockRejectedValueOnce(new Error("already exists"));
			const result = await run({ type: "command", name: "foo" });
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("scaffold.already_exists");
		});

		it("should handle validation error from execute", async () => {
			mockExecuteScaffold.mockRejectedValueOnce(new Error("Invalid name"));
			const result = await run({ type: "command", name: "foo" });
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("scaffold.invalid_name");
		});

		it("should handle random error", async () => {
			mockExecuteScaffold.mockRejectedValueOnce(new Error("boom"));
			const result = await run({ type: "command", name: "foo" });
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("scaffold.runtime_error");
		});
	});

	describe("handleScaffoldSuccess", () => {
		it("should output standard success for command", async () => {
			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			await handleScaffoldSuccess(
				{
					ok: true,
					traceId: "t1",
					kind: "command",
					name: "foo",
					files: ["f"],
					dryRun: false,
				},
				{},
			);
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("Scaffold success"),
			);
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Run tests"));
			logSpy.mockRestore();
		});

		it("should output standard success for prompt", async () => {
			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			await handleScaffoldSuccess(
				{
					ok: true,
					traceId: "t1",
					kind: "prompt",
					name: "bar",
					files: ["p.md"],
					dryRun: false,
				},
				{},
			);
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("Validate prompt"),
			);
			logSpy.mockRestore();
		});

		it("should output dry run message", async () => {
			const logSpy = spyOn(console, "log").mockImplementation(() => {});
			await handleScaffoldSuccess(
				{
					ok: true,
					traceId: "t1",
					kind: "command",
					name: "foo",
					files: [],
					dryRun: true,
				},
				{},
			);
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DRY RUN"));
			expect(logSpy).not.toHaveBeenCalledWith(
				expect.stringContaining("Next Steps"),
			);
			logSpy.mockRestore();
		});

		it("should output json success", async () => {
			// We can't easily mock renderJsonOrWrite if we didn't export it/mock it.
			// But we can check if it finishes without error.
			await handleScaffoldSuccess(
				{
					ok: true,
					traceId: "t1",
					kind: "command",
					name: "foo",
					files: ["f"],
					dryRun: false,
				},
				{ json: true },
			);
		});
	});

	describe("handleScaffoldFailure", () => {
		it("should log invalid name error", async () => {
			const errorSpy = spyOn(console, "error").mockImplementation(() => {});
			await handleScaffoldFailure(
				{ code: "scaffold.invalid_name", message: "bad name" },
				{ json: false },
			);
			expect(errorSpy).toHaveBeenCalledWith("❌ Validation Error: bad name");
			errorSpy.mockRestore();
		});

		it("should log runtime error", async () => {
			const errorSpy = spyOn(console, "error").mockImplementation(() => {});
			await handleScaffoldFailure(
				{ code: "scaffold.runtime_error", message: "oops" },
				{ json: false },
			);
			expect(errorSpy).toHaveBeenCalledWith("❌ Runtime Error: oops");
			errorSpy.mockRestore();
		});

		it("should handle json error", async () => {
			const errorSpy = spyOn(console, "error").mockImplementation(() => {});
			// Should not console.error, but write json (or fail silently if we don't mock it)
			await handleScaffoldFailure(
				{ code: "scaffold.runtime_error", message: "oops" },
				{ json: true },
			);
			expect(errorSpy).not.toHaveBeenCalled();
			errorSpy.mockRestore();
		});
	});
});
