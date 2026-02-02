import { describe, test, expect, mock } from "bun:test";
import { executeFormat } from "./format";

mock.module("execa", () => ({
    execa: async (cmd: string, args: string[]) => {
        if (cmd === "bun" && args[0] === "biome" && args[1] === "format") {
            return { stdout: "Formatted file.ts" };
        }
        return { stdout: "" };
    },
}));

describe("Code Format Feature", () => {
    test("executeFormat runs biome wrapper", async () => {
        const output = await executeFormat("src/file.ts");
        expect(output).toContain("Formatted");
    });
});
