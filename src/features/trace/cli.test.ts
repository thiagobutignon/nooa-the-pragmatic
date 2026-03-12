import { describe, expect, test } from "bun:test";
import command, { traceHelp, traceMeta, traceRun, type TraceRunInput } from "./cli";

describe("trace feature", () => {
	test("exports a valid command", () => {
		expect(command.name).toBe("trace");
		expect(command.description).toContain("execution traces");
		expect(typeof command.execute).toBe("function");
	});

	test("traceMeta exposes name and version", () => {
		expect(traceMeta.name).toBe("trace");
		expect(traceMeta.changelog[0]?.version).toBe("1.0.0");
	});

	test("help includes inspect subcommand", () => {
		expect(traceHelp).toContain("Usage: nooa trace <subcommand>");
		expect(traceHelp).toContain("inspect");
		expect(traceHelp).toContain("-- <command...>");
	});

	test("returns validation error when subcommand is missing", async () => {
		const result = await traceRun({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("trace.missing_subcommand");
			expect(result.error.message).toBe("Missing subcommand.");
		}
	});

	test("returns help mode when subcommand is help", async () => {
		const input: TraceRunInput = { action: "help" };
		const result = await traceRun(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("help");
			expect(result.data.raw).toContain("Usage: nooa trace");
		}
	});
});
