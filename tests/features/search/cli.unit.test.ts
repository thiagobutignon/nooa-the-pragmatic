import { describe, expect, it, mock, spyOn, beforeEach, afterEach } from "bun:test";
import {
    run,
    parseSearchInput,
    handleSearchSuccess
} from "../../../src/features/search/cli";

// Mock engine
const mockRunSearch = mock(async () => ([]));
const mockHasRipgrep = mock(async () => true);

mock.module("../../../src/features/search/engine", () => ({
    runSearch: mockRunSearch,
    hasRipgrep: mockHasRipgrep,
}));

describe("search CLI unit tests", () => {
    beforeEach(() => {
        mockRunSearch.mockClear();
        mockHasRipgrep.mockClear();
    });

    describe("parseSearchInput", () => {
        it("should parse query and root", async () => {
            const result = await parseSearchInput({
                values: {},
                positionals: ["search", "query_text", "src"]
            });
            expect(result.query).toBe("query_text");
            expect(result.root).toBe("src");
        });

        it("should parse flags", async () => {
            const result = await parseSearchInput({
                values: { regex: true, "max-results": "50", include: ["*.ts"] },
                positionals: ["search", "foo"]
            });
            expect(result.regex).toBe(true);
            expect(result["max-results"]).toBe("50");
            expect(result.include).toEqual(["*.ts"]);
        });
    });

    describe("run", () => {
        it("should execute search", async () => {
            mockRunSearch.mockResolvedValueOnce([{ path: "foo.ts", line: 1 }]);

            const result = await run({ query: "foo" });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data.results).toHaveLength(1);
            }
            expect(mockRunSearch).toHaveBeenCalled();
        });

        it("should validate query requirement", async () => {
            const result = await run({});
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("search.missing_query");
            }
        });

        it("should validate max-results", async () => {
            const result = await run({ query: "foo", "max-results": "bad" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("search.invalid_max_results");
            }
        });

        it("should handle runtime error", async () => {
            mockRunSearch.mockRejectedValueOnce(new Error("Ripgrep failed"));
            const result = await run({ query: "foo" });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe("search.runtime_error");
            }
        });
    });

    describe("handleSearchSuccess", () => {
        let stdoutSpy: any;
        let stderrSpy: any;

        beforeEach(() => {
            stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
            stderrSpy = spyOn(console, "error").mockImplementation(() => { });
        });

        afterEach(() => {
            stdoutSpy.mockRestore();
            stderrSpy.mockRestore();
        });

        it("should handle plain output", () => {
            handleSearchSuccess({
                results: [{ path: "f.ts", line: 1, column: 1, snippet: "code" }]
            }, {});
            expect(stdoutSpy).toHaveBeenCalledWith("f.ts:1:1:code\n");
            expect(stderrSpy).toHaveBeenCalledWith("Found 1 matches");
        });

        it("should handle files-only", () => {
            handleSearchSuccess({
                results: [
                    { path: "f.ts" },
                    { path: "f.ts" } // duplicate
                ]
            }, { "files-only": true });
            expect(stdoutSpy).toHaveBeenCalledWith("f.ts\n");
            expect(stderrSpy).toHaveBeenCalledWith("Found 1 files");
        });

        it("should handle count", () => {
            handleSearchSuccess({
                results: [{ path: "f.ts", matchCount: 5 }]
            }, { count: true });
            expect(stdoutSpy).toHaveBeenCalledWith("f.ts:5\n");
        });
    });
});
