import { describe, test, expect, beforeEach, spyOn, afterEach } from "bun:test";
import readCommand from "./cli";
import { EventBus } from "../../core/event-bus";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, "tmp-test-read");

describe("read command", () => {
    let bus: EventBus;

    beforeEach(async () => {
        bus = new EventBus();
        await mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    test("help: displays help", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await readCommand.execute({ args: ["read"], rawArgs: ["read", "--help"], values: { help: true } as any, bus });
        expect(output).toContain("Usage: nooa read");
    });

    test("failure: missing path and TTY", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("Path is required")) errorLogged = true;
        });

        // Mock TTY
        const originalTTY = process.stdin.isTTY;
        (process.stdin as any).isTTY = true;

        await readCommand.execute({ args: ["read"], rawArgs: ["read"], values: {} as any, bus });

        (process.stdin as any).isTTY = originalTTY;
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(2);
        process.exitCode = 0;
    });

    test("success: read path from stdin", async () => {
        const filePath = join(TEST_DIR, "stdin_path.txt");
        await writeFile(filePath, "stdin content");

        // Mock stdin
        const originalStdin = process.stdin;
        const mockStdin = {
            isTTY: false,
            [Symbol.asyncIterator]: async function* () {
                yield Buffer.from(filePath);
            }
        } as any;
        Object.defineProperty(process, 'stdin', { value: mockStdin, configurable: true });

        let output = "";
        spyOn(process.stdout, "write").mockImplementation((data: any) => {
            output += data.toString();
            return true;
        });

        await readCommand.execute({ args: ["read"], rawArgs: ["read"], values: {} as any, bus });

        Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
        expect(output).toBe("stdin content");
    });

    test("success: json output", async () => {
        const filePath = join(TEST_DIR, "test.json");
        await writeFile(filePath, "test content");

        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await readCommand.execute({ args: ["read", filePath], rawArgs: ["read", filePath, "--json"], values: { json: true } as any, bus });

        const parsed = JSON.parse(output);
        expect(parsed.path).toBe(filePath);
        expect(parsed.content).toBe("test content");
        expect(parsed.bytes).toBe(12);
    });

    test("error handling: file not found", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("File not found")) errorLogged = true;
        });

        await readCommand.execute({ args: ["read", "nonexistent.txt"], rawArgs: ["read", "nonexistent.txt"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = 0;
    });

    test("error handling: other error", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("Error: ")) errorLogged = true;
        });

        // Try to read a directory as a file which should throw an error on some systems or different error message
        await readCommand.execute({ args: ["read", TEST_DIR], rawArgs: ["read", TEST_DIR], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = 0;
    });
});
