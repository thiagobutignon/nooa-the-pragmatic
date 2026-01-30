import { describe, test, expect, beforeEach, spyOn, mock, afterEach } from "bun:test";
import resumeCommand from "./cli";
import { EventBus } from "../../core/event-bus";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

import * as converter from "./converter.js";
import * as jsonResume from "./json-resume.js";
import * as pdfGenerator from "./pdf-generator.js";

const TEST_DIR = join(import.meta.dir, "tmp-test-resume");

describe("resume command", () => {
    let bus: EventBus;

    beforeEach(async () => {
        bus = new EventBus();
        await mkdir(TEST_DIR, { recursive: true });

        // Only mock the slow/external pdf generator if necessary
        spyOn(pdfGenerator, "generatePdfFromMarkdown").mockImplementation(async () => { });
    });

    afterEach(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    test("help: displays help", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await resumeCommand.execute({ args: ["resume"], values: { help: true } as any, bus });
        expect(output).toContain("Usage: nooa resume");
    });

    test("failure: missing input file", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("Input file is required")) errorLogged = true;
        });

        await resumeCommand.execute({ args: ["resume"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });

    test("failure: file not found", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("File not found")) errorLogged = true;
        });

        await resumeCommand.execute({ args: ["resume", "nonexistent.md"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });

    test("success: from-json-resume to markdown (stdout)", async () => {
        const jsonPath = join(TEST_DIR, "resume.json");
        await writeFile(jsonPath, JSON.stringify({ basics: { name: "Test User" } }));

        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await resumeCommand.execute({ args: ["resume", jsonPath], values: { "from-json-resume": true } as any, bus });
        expect(output).toContain("# Test User");
    });

    test("success: from-json-resume to pdf", async () => {
        const jsonPath = join(TEST_DIR, "resume.json");
        await writeFile(jsonPath, JSON.stringify({ basics: { name: "Test" } }));

        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("Successfully generated PDF")) errorLogged = true;
        });

        await resumeCommand.execute({ args: ["resume", jsonPath], values: { "from-json-resume": true, "to-pdf": true, output: join(TEST_DIR, "out.pdf") } as any, bus });
        expect(errorLogged).toBe(true);
    });

    test("success: markdown to json-resume (stdout)", async () => {
        const mdPath = join(TEST_DIR, "resume.md");
        await writeFile(mdPath, "# Test Name");

        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await resumeCommand.execute({ args: ["resume", mdPath], values: { "to-json-resume": true } as any, bus });
        expect(output).toContain('"name": "Test Name"');
    });

    test("success: extraction flow (markdown)", async () => {
        const mdPath = join(TEST_DIR, "resume-alt.md");
        await writeFile(mdPath, "# Extracted Content\n\nContact: test@example.com");

        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        // Mock the converter just for this test to return what we want
        const spy = spyOn(converter, "convertPdfToMarkdown").mockImplementation(async () => "# Extracted Content");

        // Trigger the extraction flow via linkedin flag
        await resumeCommand.execute({ args: ["resume", mdPath], values: { linkedin: "url" } as any, bus });

        expect(output).toContain("# Extracted Content");
        spy.mockRestore();
    });
});
