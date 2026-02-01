import { expect, test, describe } from "bun:test";
import { execa } from "execa";

describe("context CLI", () => {
	test("outputs context for a file", async () => {
		const { stdout, exitCode } = await execa(
			"bun",
			["index.ts", "context", "src/core/logger.ts", "--json"],
			{ reject: false },
		);
		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("target");
	});
});
