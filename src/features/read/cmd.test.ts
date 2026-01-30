import { describe, expect, test } from "bun:test";
import cmd from "./cli"; // Changed to cli.ts to match Loader expectation

describe("Read Command Definition", () => {
    test("exports valid command", () => {
        expect(cmd.name).toBe("read");
        expect(cmd.description).toContain("Read file");
        expect(typeof cmd.execute).toBe("function");
    });
});
