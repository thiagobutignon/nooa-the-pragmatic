import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("cron cli", () => {
	test("add command requires name and schedule", async () => {
		const { stderr, exitCode } = await execa("bun", [binPath, "cron", "add"], {
			reject: false,
		});
		expect(exitCode).toBe(2);
		expect(stderr).toContain(
			"Error: Name and schedule are required for 'add'.",
		);
	});
});
