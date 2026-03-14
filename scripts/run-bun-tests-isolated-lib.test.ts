import { describe, expect, it } from "bun:test";
import {
	filterMatchedFiles,
	parseRunnerArgs,
} from "./run-bun-tests-isolated-lib";

describe("parseRunnerArgs", () => {
	it("defaults to serial execution when no concurrency is provided", () => {
		const parsed = parseRunnerArgs([], 1);

		expect(parsed).toEqual({
			cliFlags: [],
			concurrency: 1,
			filters: [],
		});
	});

	it("parses explicit concurrency and forwards bun flags", () => {
		const parsed = parseRunnerArgs(
			["--coverage", "--timeout", "30000", "-j", "3", "store.test.ts"],
			1,
		);

		expect(parsed).toEqual({
			cliFlags: ["--coverage", "--timeout", "30000"],
			concurrency: 3,
			filters: ["store.test.ts"],
		});
	});
});

describe("filterMatchedFiles", () => {
	it("returns files in sorted order when no filters are provided", () => {
		const matched = filterMatchedFiles(["b.test.ts", "a.test.ts"], []);

		expect(matched).toEqual(["a.test.ts", "b.test.ts"]);
	});

	it("filters by substring and keeps sorted output", () => {
		const matched = filterMatchedFiles(
			["src/beta.test.ts", "src/alpha.test.ts", "src/alpha.spec.ts"],
			["alpha"],
		);

		expect(matched).toEqual(["src/alpha.spec.ts", "src/alpha.test.ts"]);
	});
});
