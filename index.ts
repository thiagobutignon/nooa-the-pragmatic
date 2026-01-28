#!/usr/bin/env bun
import { parseArgs } from "util";
import { convertPdfToMarkdown } from "./src/converter.js";
import { generatePdfFromMarkdown } from "./src/pdf-generator.js";
import { writeFile } from "fs/promises";

const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
        output: {
            type: "string",
            short: "o",
        },
        "to-pdf": {
            type: "boolean",
        },
        json: {
            type: "boolean",
        },
        version: {
            type: "boolean",
            short: "v",
        },
        help: {
            type: "boolean",
            short: "h",
        },
    },
    strict: true,
    allowPositionals: true,
});

if (values.help) {
    console.log(`
Usage: resume2md [flags] <input>

Arguments:
  <input>    Path to the source file (PDF for extraction, Markdown for generation).

Flags:
  -o, --output <file>    Output file path.
  --to-pdf               Convert input Markdown to PDF.
  --json                 Output structure as JSON (extraction only).
  -v, --version          Show version.
  -h, --help             Show help.
`);
    process.exit(0);
}

if (values.version) {
    console.log("resume2md v1.1.0");
    process.exit(0);
}

const inputPath = positionals[2];

if (!inputPath) {
    console.error("Error: Input file is required.");
    console.error("Run with --help for usage.");
    process.exit(1);
}

const file = Bun.file(inputPath);

if (!(await file.exists())) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
}

try {
    if (values["to-pdf"]) {
        // Markdown to PDF mode
        const markdown = await file.text();
        const outputPath = values.output || "resume.pdf";

        await generatePdfFromMarkdown(markdown, outputPath);
        console.error(`Successfully generated PDF at ${outputPath}`);

    } else {
        // PDF to Markdown mode
        const buffer = Buffer.from(await file.arrayBuffer());
        const markdown = await convertPdfToMarkdown(buffer);

        const outputContent = values.json
            ? JSON.stringify({ content: markdown }, null, 2)
            : markdown;

        if (values.output) {
            await writeFile(values.output, outputContent);
            console.error(`Successfully converted ${inputPath} to ${values.output}`);
        } else {
            console.log(outputContent);
        }
    }

} catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
}