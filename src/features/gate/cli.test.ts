import { describe, expect, spyOn, test, beforeEach, afterEach } from "bun:test";
import * as execute from "./execute";
import gateCommand, { _gateBuilder, run } from "./cli";

describe("Gate CLI", () => {
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
        test("calls checkGate when action is check and id provided", async () => {
            const spy = spyOn(execute, "checkGate").mockResolvedValue({
                ok: true,
                data: { ok: true, gateId: "spec" },
            });

            const result = await run({ action: "check", id: "spec" });

            expect(result.ok).toBe(true);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        test("returns help when action is missing (or not check)", async () => {
            const result = await run({});
            expect(result.ok).toBe(true);
            if (result.ok) {
                // It returns data.gateId = "help"
                expect((result.data as any).gateId).toBe("help");
            }
        });

        test("returns error when id is missing", async () => {
            const result = await run({ action: "check" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("gate.missing_id");
            }
        });
    });

    describe("Command Execution (onSuccess/onFailure)", () => {
        test("executes check and prints success", async () => {
            const spy = spyOn(execute, "checkGate").mockResolvedValue({
                ok: true,
                data: { ok: true, gateId: "spec" },
            });

            await gateCommand.execute({
                rawArgs: ["gate", "check", "--id", "spec"],
                bus: mockBus,
            } as any);

            expect(spy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Gate 'spec' passed"),
            );
            expect(process.exitCode).toBeFalsy();
            spy.mockRestore();
        });

        test("executes check and prints failure", async () => {
            const spy = spyOn(execute, "checkGate").mockResolvedValue({
                ok: true,
                data: {
                    ok: false,
                    gateId: "spec",
                    reason: "Bad code",
                    suggestions: ["Refactor"]
                },
            });

            await gateCommand.execute({
                rawArgs: ["gate", "check", "--id", "spec"],
                bus: mockBus,
            } as any);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Gate 'spec' failed"),
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Reason: Bad code"),
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("- Refactor"),
            );
            expect(process.exitCode).toBe(1);
            spy.mockRestore();
        });

        test("prints help when gateId is help", async () => {
            // Mock run logic indirectly or through builder
            // gateCommand uses run which returns help when action is undefined.

            await gateCommand.execute({
                rawArgs: ["gate"],
                bus: mockBus,
            } as any);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining("Usage: nooa gate"),
            );
        });

        test("outputs JSON when requested", async () => {
            const spy = spyOn(execute, "checkGate").mockResolvedValue({
                ok: true,
                data: { ok: true, gateId: "spec" },
            });

            await gateCommand.execute({
                rawArgs: ["gate", "check", "--id", "spec", "--json"],
                bus: mockBus,
            } as any);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('"gateId":"spec"'),
            );
            spy.mockRestore();
        });

        test("handles missing id error", async () => {
            await gateCommand.execute({
                rawArgs: ["gate", "check"],
                bus: mockBus,
            } as any);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Gate ID is required"),
            );
            expect(process.exitCode).toBe(2);
        });

        test("handles unknown gate error", async () => {
            const spy = spyOn(execute, "checkGate").mockResolvedValue({
                ok: false,
                error: { code: "gate.unknown_gate", message: "Unknown" } as any,
            });

            await gateCommand.execute({
                rawArgs: ["gate", "check", "--id", "magic"],
                bus: mockBus,
            } as any);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Unknown"),
            );
            expect(process.exitCode).toBe(2);
            spy.mockRestore();
        });
    });
});
