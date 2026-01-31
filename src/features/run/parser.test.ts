import { describe, expect, it } from "bun:test";
import { parsePipelineArgs } from "./parser";

describe("pipeline parser", () => {
    describe("delimiter mode", () => {
        it("splits by --", () => {
            const args = ["code", "write", "foo", "--", "commit", "-m", "msg"];
            const steps = parsePipelineArgs(args);
            expect(steps).toHaveLength(2);
            expect(steps[0]!.argv).toEqual(["code", "write", "foo"]);
            expect(steps[1]!.argv).toEqual(["commit", "-m", "msg"]);
        });

        it("unescapes \\-- in delimiter mode", () => {
            const args = ["--", "exec", "echo", "abc", "\\--", "def"];
            const steps = parsePipelineArgs(args);
            expect(steps[0]!.argv).toEqual(["echo", "abc", "--", "def"]);
        });

        it("handles internal vs external", () => {
            const args = ["nooa", "code", "--", "exec", "ls", "-la"];
            const steps = parsePipelineArgs(args);
            expect(steps[0]!.kind).toBe("internal");
            expect(steps[1]!.kind).toBe("external");
            expect(steps[1]!.argv).toEqual(["ls", "-la"]);
        });
    });

    describe("string mode", () => {
        it("parses quoted strings", () => {
            const args = ["code write foo", "commit -m 'hello world'"];
            const steps = parsePipelineArgs(args);
            expect(steps).toHaveLength(2);
            expect(steps[0]!.argv).toEqual(["code", "write", "foo"]);
            expect(steps[1]!.argv).toEqual(["commit", "-m", "hello world"]);
        });

        it("unescapes \\-- in string mode", () => {
            // Note: shell-quote might require double escaping or specific handling if passed as string
            // But here we are passing the string "exec echo \--" which shell-quote will parse
            const args = ["exec echo \\--"];
            const steps = parsePipelineArgs(args);
            expect(steps[0]!.argv).toEqual(["echo", "--"]);
        });

        it("detects exec prefix", () => {
            const args = ["exec ls -la", "code write"];
            const steps = parsePipelineArgs(args);
            expect(steps[0]!.kind).toBe("external");
            expect(steps[0]!.argv).toEqual(["ls", "-la"]);
            expect(steps[1]!.kind).toBe("internal");
        });
    });
});
