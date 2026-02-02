import { describe, expect, mock, test } from "bun:test";
import { executeFormat } from "./format";

describe("Code Format Feature", () => {
	test("executeFormat runs biome wrapper", async () => {
		const exec = mock(async () => ({ stdout: "Formatted file.ts" }));
		const output = await executeFormat("src/file.ts", exec);
		expect(output).toContain("Formatted");
	});
});
