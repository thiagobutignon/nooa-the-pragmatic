import { expect, test, describe } from "bun:test";
import { execa } from "execa";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa pr", () => {
    test("pr --help shows usage", async () => {
        const { stdout } = await execa("bun", [binPath, "pr", "--help"], { reject: false });
        expect(stdout).toContain("Usage: nooa pr");
    });
});
