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

describe("nooa message validation", () => {
    it("requires message text", async () => {
        const res = await execa("bun", [binPath, "message"], { reject: false });
        expect(res.exitCode).toBe(1);
        expect(res.stderr).toContain("Error: Message text is required");
    });

    it("validates role values", async () => {
        const res = await execa("bun", [binPath, "message", "test", "--role", "invalid"], { reject: false });
        expect(res.exitCode).toBe(1);
        expect(res.stderr).toContain("Invalid role");
    });

    it("accepts valid roles", async () => {
        const roles = ["user", "system", "assistant"];
        for (const role of roles) {
            const res = await execa("bun", [binPath, "message", "test", "--role", role], { reject: false });
            expect(res.exitCode).toBe(0);
        }
    });
});
