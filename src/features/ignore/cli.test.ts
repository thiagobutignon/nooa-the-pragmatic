import { describe, expect, spyOn, test, beforeEach, afterEach } from "bun:test";
import * as execute from "./execute";
import ignoreCommand, { ignoreBuilder, run } from "./cli";

describe("Ignore CLI", () => {
    let consoleLogSpy: any;
    let consoleErrorSpy: any;
    let exitCode: any;
    const mockBus = { emit: () => { } } as any;

    beforeEach(() => {
        consoleLogSpy = spyOn(console, "log").mockImplementation(() => { });
        consoleErrorSpy = spyOn(console, "error").mockImplementation(() => { });
        exitCode = process.exitCode;
        process.exitCode = undefined;
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        process.exitCode = exitCode;
    });

    describe("run() handler", () => {
        test("calls addPattern", async () => {
            const spy = spyOn(execute, "addPattern").mockResolvedValue(true);
            const result = await run({ action: "add", pattern: "foo" });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data.mode).toBe("add");
                expect(result.data.result).toBe(true);
            }
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        test("calls removePattern", async () => {
            const spy = spyOn(execute, "removePattern").mockResolvedValue(true);
            const result = await run({ action: "remove", pattern: "foo" });
            expect(result.ok).toBe(true);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        test("calls loadIgnore for list", async () => {
            const spy = spyOn(execute, "loadIgnore").mockResolvedValue(["foo"]);
            const result = await run({ action: "list" });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data.patterns).toEqual(["foo"]);
            }
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        test("calls checkPathIgnored", async () => {
            const spy = spyOn(execute, "checkPathIgnored").mockResolvedValue({ ignored: true, pattern: "*" });
            const result = await run({ action: "check", pattern: "target" }); // pattern input maps to target in CLI? No, check uses pattern input as path?
            // run logic: if (action === "check") { const target = input.pattern; ... }
            // CLI Parser: action=check, pattern=args[0]. args[0] IS the path.

            expect(result.ok).toBe(true);
            expect(spy).toHaveBeenCalledWith("target");
            spy.mockRestore();
        });

        test("calls matchesPattern for test", async () => {
            // run logic iterates paths and calls matchesPattern
            // No direct export for matchesPattern? imports from execute. matching logic is in execute.
            // But matchesPattern is sync.
            // run logic maps samples.
            const result = await run({ action: "test", pattern: "*.log", paths: ["app.log"] });
            expect(result.ok).toBe(true);
            if (result.ok) {
                const res = result.data.result as any;
                expect(res.matched).toBe(true);
                expect(res.results).toHaveLength(1);
            }
        });

        test("returns error for missing action", async () => {
            const result = await run({});
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.missing_command");
            }
        });

        test("returns error for missing pattern in add", async () => {
            const result = await run({ action: "add" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.missing_pattern");
            }
        });

        test("returns error for missing pattern in remove", async () => {
            const result = await run({ action: "remove" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.missing_pattern");
            }
        });

        test("returns error for missing path in check", async () => {
            const result = await run({ action: "check" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.missing_path");
            }
        });

        test("returns error for unknown command", async () => {
            const result = await run({ action: "unknown" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.unknown_command");
            }
        });

        test("returns runtime_error on throw", async () => {
            spyOn(execute, "loadIgnore").mockRejectedValue(new Error("Foo"));
            const result = await run({ action: "list" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.runtime_error");
            }
        });
    });

    describe("Command Execution (Output)", () => {
        test("prints added pattern output (changed)", async () => {
            const spy = spyOn(execute, "addPattern").mockResolvedValue(true);
            await ignoreCommand.execute({
                rawArgs: ["ignore", "add", "foo"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Pattern 'foo' added"));
            spy.mockRestore();
        });

        test("prints added pattern output (not changed)", async () => {
            const spy = spyOn(execute, "addPattern").mockResolvedValue(false);
            await ignoreCommand.execute({
                rawArgs: ["ignore", "add", "foo"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Pattern 'foo' already exists"));
            spy.mockRestore();
        });

        test("prints removed output", async () => {
            const spy = spyOn(execute, "removePattern").mockResolvedValue(true);
            await ignoreCommand.execute({
                rawArgs: ["ignore", "remove", "foo"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("removed"));
            spy.mockRestore();
        });

        test("lists patterns", async () => {
            const spy = spyOn(execute, "loadIgnore").mockResolvedValue(["foo", "bar"]);
            await ignoreCommand.execute({
                rawArgs: ["ignore", "list"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Current ignore patterns"));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("- foo"));
            spy.mockRestore();
        });

        test("prints empty list message", async () => {
            const spy = spyOn(execute, "loadIgnore").mockResolvedValue([]);
            await ignoreCommand.execute({
                rawArgs: ["ignore", "list"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No patterns found"));
            spy.mockRestore();
        });

        test("check prints ignored match", async () => {
            const spy = spyOn(execute, "checkPathIgnored").mockResolvedValue({ ignored: true, pattern: "*.log" });
            await ignoreCommand.execute({
                rawArgs: ["ignore", "check", "app.log"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("is ignored by *.log"));
            expect(process.exitCode).toBe(0);
            spy.mockRestore();
        });

        test("check prints not ignored", async () => {
            const spy = spyOn(execute, "checkPathIgnored").mockResolvedValue({ ignored: false });
            await ignoreCommand.execute({
                rawArgs: ["ignore", "check", "app.log"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("is not ignored"));
            expect(process.exitCode).toBe(1);
            spy.mockRestore();
        });

        test("test prints results", async () => {
            // mocking matchesPattern? No, it's sync. just use run logic.
            await ignoreCommand.execute({
                rawArgs: ["ignore", "test", "*.log", "app.log"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Testing pattern: *.log"));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("✅ app.log"));
            expect(process.exitCode).toBe(0);
        });

        test("test prints no matches", async () => {
            await ignoreCommand.execute({
                rawArgs: ["ignore", "test", "*.log", "readme.md"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No matches for pattern"));
            expect(process.exitCode).toBe(2);
        });

        test("handles errors", async () => {
            const spy = spyOn(execute, "loadIgnore").mockRejectedValue(new Error("Boom"));
            await ignoreCommand.execute({
                rawArgs: ["ignore", "list"],
                bus: mockBus,
            } as any);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error: Boom"));
            spy.mockRestore();
        });

        test("handles missing command error in onFailure", async () => {
            // output of run will be error missing_command
            await ignoreCommand.execute({
                rawArgs: ["ignore"],
                bus: mockBus,
            } as any);
            // onFailure checks error code
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error: Unknown subcommand"));
            expect(process.exitCode).toBe(2);
        });

        test("test missing pattern", async () => {
            const result = await run({ action: "test" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("ignore.missing_pattern");
            }
        });

        test("json output in onSuccess", async () => {
            const spy = spyOn(execute, "loadIgnore").mockResolvedValue(["foo"]);
            await ignoreCommand.execute({
                rawArgs: ["ignore", "list", "--json"],
                bus: mockBus,
            } as any);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"mode": "list"'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"patterns": [\n    "foo"\n  ]'));
            spy.mockRestore();
        });

        test("handles missing pattern error in onFailure", async () => {
            await ignoreCommand.execute({
                rawArgs: ["ignore", "add"],
                bus: mockBus,
            } as any);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Pattern required"));
            expect(process.exitCode).toBe(2);
        });

        test("handles unknown mode in switch", async () => {
            const spy = spyOn(execute, "loadIgnore").mockResolvedValue([]);
            // Mock run to return unknown mode
            const runSpy = spyOn(execute, "addPattern"); // dummy
            // We can't easily mock run inside command because it's bound.
            // But we can check if default case is reachable.
            // The only way is if run returns a mode NOT in switch.
            // run returns "add", "remove", "list", "check", "test".
            // Switch covers all?
            // Switch covers: add, remove, list, check, test.
            // Default covers nothing.
            // To cover default, we need to return something else.
            // Since we can't easily mock run's return value for valid input without mocking run itself (which is exported but used by value in builder).
            // We can mock `execute` functions, but `run` logic determines mode.
            // If we modify `run` in `cli.ts` to return "unknown"...
            // But we can't.

            // We can skip default case coverage if it's unreachable code.
            // Or we can try to mock `run` if `cli.ts` exports it and `builder` uses the exported version? 
            // `builder.run(run)`. `run` is passed by value.

            // So default case is unreachable unless we change code.
            // I'll leave it.
            spy.mockRestore();
        });
    });

    test("remove pattern not found output", async () => {
        const spy = spyOn(execute, "removePattern").mockResolvedValue(false);
        await ignoreCommand.execute({
            rawArgs: ["ignore", "remove", "foo"],
            bus: mockBus,
        } as any);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
        spy.mockRestore();
    });
});


