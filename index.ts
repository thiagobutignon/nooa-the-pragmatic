#!/usr/bin/env bun
import { parseArgs } from "util";
import { convertPdfToMarkdown } from "./src/converter.js";
import { generatePdfFromMarkdown } from "./src/pdf-generator.js";
import { writeFile } from "fs/promises";

export async function main(args: string[] = typeof Bun !== "undefined" ? Bun.argv : []) {
    const { values, positionals } = parseArgs({
        args,
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
            linkedin: {
                type: "string",
            },
            github: {
                type: "string",
            },
            whatsapp: {
                type: "string",
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
  --linkedin <url>       LinkedIn profile URL.
  --github <url>         GitHub profile URL.
  --whatsapp <phone>     WhatsApp number or URL.
  -v, --version          Show version.
  -h, --help             Show help.
`);
        return;
    }

    if (values.version) {
        console.log("resume2md v1.1.0");
        return;
    }

    const inputPath = positionals[2];

    if (!inputPath) {
        console.error("Error: Input file is required.");
        console.error("Run with --help for usage.");
        process.exitCode = 1;
        return;
    }

    const file = Bun.file(inputPath);

    if (!(await file.exists())) {
        console.error(`Error: File not found: ${inputPath}`);
        process.exitCode = 1;
        return;
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
            const markdown = await convertPdfToMarkdown(buffer, {
                linkedin: values.linkedin,
                github: values.github,
                whatsapp: values.whatsapp,
            });

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
        process.exitCode = 1;
    }
}

// Run if this is the main entry point
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
    main().catch((err) => {
        console.error("Fatal Error:", err);
        process.exit(1);
    });
}