import { describe, expect, spyOn, test } from "bun:test";
import * as execute from "../index/execute";
import { DEFAULT_SEARCH_LIMIT } from "../index/execute";
import { run } from "./cli";

describe("ask CLI", () => {
	test("uses default search limit when limit not provided", async () => {
		const searchSpy = spyOn(execute, "executeSearch").mockResolvedValue([]);

		const result = await run({ query: "find todos" });

		expect(result.ok).toBe(true);
		expect(searchSpy).toHaveBeenCalledWith("find todos", DEFAULT_SEARCH_LIMIT);
		searchSpy.mockRestore();
	});
});
