#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { convertPdfToMarkdown } from "./src/converter.js";
import {
	convertJsonResumeToMarkdown,
	convertMarkdownToJsonResume,
} from "./src/json-resume.js";
import { generatePdfFromMarkdown } from "./src/pdf-generator.js";

// ... existing main function signature ...
export async function main(
	args: string[] = typeof Bun !== "undefined" ? Bun.argv : [],
) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			// ... existing options ...
			output: { type: "string", short: "o" },
			"to-pdf": { type: "boolean" },
			json: { type: "boolean" },
			"to-json-resume": { type: "boolean" },
			"from-json-resume": { type: "boolean" },
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
			linkedin: { type: "string" },
			github: { type: "string" },
			whatsapp: { type: "string" },
			validate: { type: "boolean" },
		},
		strict: true,
		allowPositionals: true,
	});

	if (values.help) {
		console.log(`
Usage: resume2md [flags] <input>

Arguments:
  <input>    Path to the source file (PDF for extraction, Markdown for generation, or JSON for conversion).

Flags:
  -o, --output <file>    Output file path.
  --to-pdf               Convert input Markdown (or JSON if --from-json-resume) to PDF.
  --json                 Output structure as JSON (extraction only).
  --to-json-resume       Convert Markdown input to JSON Resume format.
  --from-json-resume     Treat input as JSON Resume file and convert to Markdown/PDF.
  --linkedin <url>       LinkedIn profile URL.
  --github <url>         GitHub profile URL.
  --whatsapp <phone>     WhatsApp number or URL.
  --validate             Scan for broken links in the resume.
  -v, --version          Show version.
  -h, --help             Show help.
`);
		return;
	}

	// ... version check ...
	if (values.version) {
		console.log("resume2md v1.1.0");
		return;
	}

	const inputPath = positionals[2];
	// ... input validation ...
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
		if (values["from-json-resume"]) {
			// JSON Resume -> Markdown -> (optional) PDF
			const jsonText = await file.text();
			const jsonResume = JSON.parse(jsonText);
			const markdown = convertJsonResumeToMarkdown(jsonResume);

			if (values["to-pdf"]) {
				const outputPath = values.output || "resume.pdf";
				await generatePdfFromMarkdown(markdown, outputPath);
				console.error(
					`Successfully generated PDF from JSON Resume at ${outputPath}`,
				);
			} else {
				const outputContent = markdown;
				if (values.output) {
					await writeFile(values.output, outputContent);
					console.error(
						`Successfully converted JSON Resume to Markdown at ${values.output}`,
					);
				} else {
					console.log(outputContent);
				}
			}
		} else if (values["to-pdf"]) {
			// Markdown -> PDF
			const markdown = await file.text();
			const outputPath = values.output || "resume.pdf";
			await generatePdfFromMarkdown(markdown, outputPath);
			console.error(`Successfully generated PDF at ${outputPath}`);
		} else {
			// PDF -> Markdown -> (optional) JSON Resume
			const buffer = Buffer.from(await file.arrayBuffer());
			const markdown = await convertPdfToMarkdown(buffer, {
				linkedin: values.linkedin,
				github: values.github,
				whatsapp: values.whatsapp,
			});

			if (values["to-json-resume"]) {
				const jsonResume = convertMarkdownToJsonResume(markdown);
				const outputContent = JSON.stringify(jsonResume, null, 2);
				if (values.output) {
					await writeFile(values.output, outputContent);
					console.error(
						`Successfully converted to JSON Resume at ${values.output}`,
					);
				} else {
					console.log(outputContent);
				}
			} else {
				// Normal mode
				const outputContent = values.json
					? JSON.stringify({ content: markdown }, null, 2)
					: markdown;

				if (values.output) {
					await writeFile(values.output, outputContent);
					console.error(
						`Successfully converted ${inputPath} to ${values.output}`,
					);
				} else {
					console.log(outputContent);
				}
			}

			// Link Validation Logic
			if (values.validate) {
				const { extractLinks, validateAllLinks } = await import(
					"./src/validator.js"
				);
				// We might be in a mode where markdown was just generated
				// or we are reading it from inputPath
				const markdownToValidate =
					typeof markdown !== "undefined" ? markdown : await file.text();

				console.error("\n🔍 Validating links...");
				const links = extractLinks(markdownToValidate);

				if (links.length === 0) {
					console.error("No links found to validate.");
				} else {
					console.error(`Found ${links.length} links. Checking reachability...`);
					const results = await validateAllLinks(links);

					let brokenCount = 0;
					for (const res of results) {
						if (res.ok) {
							console.error(`  ✅ [${res.status}] ${res.url}`);
						} else {
							console.error(
								`  ❌ [${res.status || "ERR"}] ${res.url}${res.error ? ` (${res.error})` : ""}`,
							);
							brokenCount++;
						}
					}

					if (brokenCount > 0) {
						console.error(
							`\n⚠️ Validation failed: ${brokenCount} link(s) are unreachable.`,
						);
						process.exitCode = 1;
					} else {
						console.error("\n✨ All links are valid!");
					}
				}
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
