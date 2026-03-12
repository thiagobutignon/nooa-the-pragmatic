import { describe, expect, test } from "bun:test";
import command, {
	debugHelp,
	debugMeta,
	debugOutputFields,
	debugRun,
	type DebugRunInput,
} from "./cli";

describe("debug feature", () => {
	test("exports a valid command", () => {
		expect(command.name).toBe("debug");
		expect(command.description).toContain("Agent-first runtime debugging");
		expect(typeof command.execute).toBe("function");
	});

	test("debugMeta exposes name and version", () => {
		expect(debugMeta.name).toBe("debug");
		expect(debugMeta.changelog[0]?.version).toBe("1.0.0");
	});

	test("help includes planned subcommands", () => {
		expect(debugHelp).toContain("nooa debug <subcommand>");
		expect(debugHelp).toContain("Agent-first commands");
		expect(debugHelp).toContain("capture");
		expect(debugHelp).toContain("inspect-at");
		expect(debugHelp).toContain("inspect-on-failure");
		expect(debugHelp).toContain("inspect-test-failure");
		expect(debugHelp).toContain("Interactive session commands (experimental)");
		expect(debugHelp).toContain("launch");
		expect(debugHelp).toContain("break");
		expect(debugHelp).toContain("state");
		expect(debugHelp).toContain("eval");
	});

	test("public output fields do not advertise interactive-only target state", () => {
		expect(debugOutputFields.some((field) => field.name === "target")).toBe(false);
		expect(debugOutputFields.some((field) => field.name === "exception")).toBe(true);
	});

	test("returns validation error when subcommand is missing", async () => {
		const result = await debugRun({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("debug.missing_subcommand");
			expect(result.error.message).toBe("Missing subcommand.");
		}
	});

	test("returns help mode when subcommand is help", async () => {
		const input: DebugRunInput = { action: "help" };
		const result = await debugRun(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("help");
			expect(result.data.raw).toContain("Usage: nooa debug");
		}
	});
});
