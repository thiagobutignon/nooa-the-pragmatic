import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import bridgeCommand from "./cli";
import { EventBus } from "../../core/event-bus";
import * as bridge from "./bridge.js";

describe("bridge command", () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus();
        // Mock the bridge module via spies
        spyOn(bridge, "loadSpec").mockImplementation(async (source: string) => {
            if (source === "invalid") throw new Error("Spec not found");
            return {
                info: { title: "Test API" },
                paths: {
                    "/test": {
                        get: { operationId: "testGet", summary: "Test Summary" }
                    }
                }
            } as any;
        });
        spyOn(bridge, "executeBridgeRequest").mockImplementation(async () => {
            return {
                status: 200,
                statusText: "OK",
                data: { success: true }
            } as any;
        });
    });

    test("help: displays help", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await bridgeCommand.execute({ args: ["bridge"], values: { help: true } as any, bus });
        expect(output).toContain("Usage: nooa bridge");
    });

    test("failure: missing spec source", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("required for bridge")) errorLogged = true;
        });

        await bridgeCommand.execute({ args: ["bridge"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });

    test("success: list operations", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output += msg + "\n";
        });

        await bridgeCommand.execute({ args: ["bridge", "myspec.yaml"], values: { list: true } as any, bus });
        expect(output).toContain("Available operations in Test API");
        expect(output).toContain("[GET] testGet (/test)");
    });

    test("failure: missing operation ID", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("--op <operationId> is required")) errorLogged = true;
        });

        await bridgeCommand.execute({ args: ["bridge", "myspec.yaml"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });

    test("success: execute operation", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });
        spyOn(console, "error").mockImplementation(() => { });

        await bridgeCommand.execute({
            args: ["bridge", "myspec.yaml"],
            values: { op: "testGet", param: ["key=val"], header: ["X-Test: val"] } as any,
            bus
        });

        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(true);
    });

    test("error handling: exception during execution", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("Bridge Error:")) errorLogged = true;
        });

        // This will trigger the catch block if args[1] is "invalid" which loadSpec throws on
        await bridgeCommand.execute({ args: ["bridge", "invalid"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });
});
