import { describe, expect, test } from "bun:test";
import command, {
	recordHelp,
	recordMeta,
	recordRun,
	type RecordRunInput,
} from "./cli";

describe("record feature", () => {
	test("exports a valid command", () => {
		expect(command.name).toBe("record");
		expect(command.description).toContain("raw execution records");
		expect(typeof command.execute).toBe("function");
	});

	test("recordMeta exposes name and version", () => {
		expect(recordMeta.name).toBe("record");
		expect(recordMeta.changelog[0]?.version).toBe("1.0.0");
	});

	test("help includes inspect subcommand", () => {
		expect(recordHelp).toContain("Usage: nooa record <subcommand>");
		expect(recordHelp).toContain("inspect");
		expect(recordHelp).toContain("-- <command...>");
	});

	test("returns validation error when subcommand is missing", async () => {
		const result = await recordRun({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("record.missing_subcommand");
			expect(result.error.message).toBe("Missing subcommand.");
		}
	});

	test("returns help mode when subcommand is help", async () => {
		const input: RecordRunInput = { action: "help" };
		const result = await recordRun(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("help");
			expect(result.data.raw).toContain("Usage: nooa record");
		}
	});
});
