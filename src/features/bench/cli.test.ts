import { describe, expect, test } from "bun:test";
import command, {
	benchHelp,
	benchMeta,
	benchRun,
	type BenchRunInput,
} from "./cli";

describe("bench feature", () => {
	test("exports a valid command", () => {
		expect(command.name).toBe("bench");
		expect(command.description).toContain("benchmark repeated command execution");
		expect(typeof command.execute).toBe("function");
	});

	test("benchMeta exposes name and version", () => {
		expect(benchMeta.name).toBe("bench");
		expect(benchMeta.changelog[0]?.version).toBe("1.0.0");
	});

	test("help includes inspect subcommand", () => {
		expect(benchHelp).toContain("Usage: nooa bench <subcommand>");
		expect(benchHelp).toContain("inspect");
		expect(benchHelp).toContain("--runs");
	});

	test("returns validation error when subcommand is missing", async () => {
		const result = await benchRun({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("bench.missing_subcommand");
			expect(result.error.message).toBe("Missing subcommand.");
		}
	});

	test("returns help mode when subcommand is help", async () => {
		const input: BenchRunInput = { action: "help" };
		const result = await benchRun(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("help");
			expect(result.data.raw).toContain("Usage: nooa bench");
		}
	});
});
