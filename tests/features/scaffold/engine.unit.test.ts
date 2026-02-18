import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ScaffoldEngine } from "../../../src/features/scaffold/engine";

// Mock fs promises
const mockAccess = mock(async () => { });
const mockMkdir = mock(async () => { });
const mockReadFile = mock(async () => "template content {{name}}");
const mockWriteFile = mock(async () => { });

mock.module("node:fs/promises", () => ({
    access: mockAccess,
    mkdir: mockMkdir,
    readFile: mockReadFile,
    writeFile: mockWriteFile
}));

describe("ScaffoldEngine", () => {
    let engine: ScaffoldEngine;

    beforeEach(() => {
        engine = new ScaffoldEngine("/templates");
        mockAccess.mockClear();
        mockMkdir.mockClear();
        mockReadFile.mockClear();
        mockWriteFile.mockClear();
    });

    describe("validateName", () => {
        it("should accept valid kebab-case names", () => {
            expect(() => engine.validateName("my-feature")).not.toThrow();
            expect(() => engine.validateName("feature1")).not.toThrow();
        });

        it("should reject invalid names", () => {
            expect(() => engine.validateName("MyFeature")).toThrow("kebab-case");
            expect(() => engine.validateName("feature space")).toThrow("kebab-case");
        });

        it("should reject reserved words", () => {
            expect(() => engine.validateName("core")).toThrow("reserved");
        });
    });

    describe("renderTemplate", () => {
        it("should replace placeholders", async () => {
            mockReadFile.mockResolvedValueOnce("Name: {{name}}, Camel: {{camelName}}");
            const content = await engine.renderTemplate("test", {
                name: "my-feat",
                camelName: "MyFeat",
                Command: "MyFeat",
                repo_root: "/",
                year: "2024"
            });

            expect(content).toBe("Name: my-feat, Camel: MyFeat");
            expect(mockReadFile).toHaveBeenCalledTimes(1);
        });
    });

    describe("ensureDir", () => {
        it("should mkdir recursive", async () => {
            await engine.ensureDir("/path/to/file.ts");
            expect(mockMkdir).toHaveBeenCalledWith("/path/to", { recursive: true });
        });
    });

    describe("write", () => {
        it("should write file if not exists", async () => {
            mockAccess.mockRejectedValueOnce(new Error("ENOENT")); // File does not exist

            await engine.write("/path/file.ts", "content", {});

            expect(mockWriteFile).toHaveBeenCalledWith("/path/file.ts", "content", "utf-8");
        });

        it("should throw if exists and not force", async () => {
            mockAccess.mockResolvedValueOnce(undefined); // File exists

            expect(engine.write("/path/file.ts", "content", {}))
                .rejects.toThrow("exists");

            expect(mockWriteFile).not.toHaveBeenCalled();
        });

        it("should overwrite if force", async () => {
            mockAccess.mockResolvedValueOnce(undefined); // File exists

            await engine.write("/path/file.ts", "content", { force: true });

            expect(mockWriteFile).toHaveBeenCalled();
        });

        it("should not write in dry run", async () => {
            await engine.write("/path/file.ts", "content", { dryRun: true });
            expect(mockWriteFile).not.toHaveBeenCalled();
        });
    });
});
