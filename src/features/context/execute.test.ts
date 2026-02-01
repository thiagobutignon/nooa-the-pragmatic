import { expect, test, describe } from "bun:test";
import { buildContext } from "./execute";

describe("Context Builder", () => {
	test("extracts related files for a given file", async () => {
		const result = await buildContext("src/core/logger.ts");
		expect(result).toHaveProperty("target");
		expect(result).toHaveProperty("related");
		expect(result).toHaveProperty("tests");
	});
});
