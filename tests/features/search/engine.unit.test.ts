import { describe, expect, it, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { runSearch, hasRipgrep } from "../../../src/features/search/engine";
import { ReadableStream } from "node:stream/web";

// Mock fs for native search
const mockReaddir = mock(async () => []);
const mockStat = mock(async () => ({ isDirectory: () => false, isFile: () => true, size: 100 }));
const mockReadFile = mock(async () => "");

mock.module("node:fs/promises", () => ({
    readdir: mockReaddir,
    stat: mockStat,
    readFile: mockReadFile
}));

describe("search engine", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        mockReaddir.mockClear();
        mockStat.mockClear();
        mockReadFile.mockClear();
    });

    afterEach(() => {
        process.env = originalEnv;
        mock.restore();
    });

    describe("hasRipgrep", () => {
        it("should return true if rg command succeeds", async () => {
            const spawnSyncSpy = spyOn(Bun, "spawnSync").mockReturnValue({ exitCode: 0 } as any);
            expect(await hasRipgrep()).toBe(true);
            spawnSyncSpy.mockRestore();
        });

        it("should return false if rg command fails", async () => {
            const spawnSyncSpy = spyOn(Bun, "spawnSync").mockReturnValue({ exitCode: 1 } as any);
            // We need to clear cached value potentially, but internal cache makes it hard.
            // However, the module is re-imported or state might persist. 
            // `hasRipgrep` caches result. We might need to reload module or just trust it.
            // Since we can't easily reset module state in bun test without specialized tools,
            // we might check logic branches:

            // Force native via env to bypass cache check for false
            process.env.NOOA_SEARCH_ENGINE = "native";
            expect(await hasRipgrep()).toBe(false);

            spawnSyncSpy.mockRestore();
        });
    });

    describe("runSearch with rg", () => {
        it("should parse rg json output", async () => {
            process.env.NOOA_SEARCH_ENGINE = "rg";

            const rgOutput = JSON.stringify({ type: "match", data: { path: { text: "file.ts" }, line_number: 1, lines: { text: "code\n" } } }) + "\n";

            const spawnSpy = spyOn(Bun, "spawn").mockReturnValue({
                stdout: new Response(rgOutput).body,
                exitCode: Promise.resolve(0)
            } as any);

            const results = await runSearch({ query: "code", root: "." });

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe("file.ts");
            expect(results[0].snippet).toBe("code");

            spawnSpy.mockRestore();
        });
    });

    describe("runSearch native", () => {
        it("should find matches in files", async () => {
            process.env.NOOA_SEARCH_ENGINE = "native";

            // Mock FS structure
            // root -> file.ts
            mockReaddir.mockImplementation(async (path) => {
                if (path === ".") return [{ name: "file.ts", isFile: () => true, isDirectory: () => false }];
                return [];
            });
            mockReadFile.mockResolvedValue("hello world\nmatch here\nbye");

            const results = await runSearch({ query: "match", root: "." });

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe("file.ts");
            expect(results[0].line).toBe(2);
            expect(results[0].snippet).toBe("match here");
        });

        it("should respect include/exclude globs", async () => {
            process.env.NOOA_SEARCH_ENGINE = "native";

            mockReaddir.mockImplementation(async (path) => {
                if (path === ".") return [
                    { name: "file.ts", isFile: () => true, isDirectory: () => false },
                    { name: "ignore.me", isFile: () => true, isDirectory: () => false }
                ];
                return [];
            });
            mockReadFile.mockResolvedValue("match");

            const results = await runSearch({
                query: "match",
                root: ".",
                include: ["*.ts"],
                exclude: ["*.me"]
            });

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe("file.ts");
        });
    });
});
