import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa push", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "push", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa push [remote] [branch]");
		expect(res.stdout).toContain("Flags:");
		expect(res.stdout).toContain("-h, --help");
		expect(res.stdout).toContain("--no-test");
	});
});
