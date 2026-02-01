import { expect, test, describe } from "bun:test";
import { execa } from "execa";

describe("skills cli", () => {
    test("list command returns 200 and listed skills", async () => {
        const { stdout, exitCode } = await execa("bun", ["index.ts", "skills", "list"], { reject: false });
        expect(exitCode).toBe(0);
        expect(stdout).toContain("Current skills:");
    });
});
