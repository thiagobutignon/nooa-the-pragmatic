import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa commit", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "commit", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa commit -m");
		expect(res.stdout).toContain("--no-test");
	});
});
