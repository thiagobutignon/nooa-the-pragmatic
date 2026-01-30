import { describe, it, expect } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa message", () => {
    it("shows help", async () => {
        const res = await execa("bun", [binPath, "message", "--help"], { reject: false });
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toContain("Usage: nooa message <text>");
        expect(res.stdout).toContain("Flags:");
        expect(res.stdout).toContain("--role");
        expect(res.stdout).toContain("--json");
        expect(res.stdout).toContain("-h, --help");
    });
});
