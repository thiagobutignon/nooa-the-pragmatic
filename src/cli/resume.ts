import { writeFile } from "node:fs/promises";
import { convertPdfToMarkdown } from "../converter.js";
import {
	convertJsonResumeToMarkdown,
	convertMarkdownToJsonResume,
} from "../json-resume.js";
import { generatePdfFromMarkdown } from "../pdf-generator.js";

const resumeHelp = `
Usage: nooa resume [flags] <input>

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
`;

type ResumeValues = {
	output?: string;
	"to-pdf"?: boolean;
	json?: boolean;
	"to-json-resume"?: boolean;
	"from-json-resume"?: boolean;
	version?: boolean;
	help?: boolean;
	linkedin?: string;
	github?: string;
	whatsapp?: string;
	validate?: boolean;
};

export async function runResumeCommand(
	values: ResumeValues,
	positionals: string[],
) {
	if (values.help) {
		console.log(resumeHelp);
		return;
	}

	const inputPath = positionals[0];
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
			const markdown = await file.text();
			const outputPath = values.output || "resume.pdf";
			await generatePdfFromMarkdown(markdown, outputPath);
			console.error(`Successfully generated PDF at ${outputPath}`);
		} else if (values["to-json-resume"]) {
			const markdown = await file.text();
			const jsonResume = convertMarkdownToJsonResume(markdown);
			const outputContent = JSON.stringify(jsonResume, null, 2);
			if (values.output) {
				await writeFile(values.output, outputContent);
				console.error(
					`Successfully converted Markdown to JSON Resume at ${values.output}`,
				);
			} else {
				console.log(outputContent);
			}
		} else {
			const buffer = Buffer.from(await file.arrayBuffer());
			let markdown: string;
			try {
				markdown = await convertPdfToMarkdown(buffer, {
					linkedin: values.linkedin,
					github: values.github,
					whatsapp: values.whatsapp,
				});
			} catch (pdfError: any) {
				if (values.validate && inputPath.endsWith(".md")) {
					markdown = await file.text();
				} else {
					throw pdfError;
				}
			}

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

			if (values.validate) {
				const { extractLinks, validateAllLinks } = await import(
					"../validator.js"
				);
				const markdownToValidate =
					typeof markdown !== "undefined" ? markdown : await file.text();

				console.error("\n🔍 Validating links...");
				const links = extractLinks(markdownToValidate);

				if (links.length === 0) {
					console.error("No links found to validate.");
				} else {
					console.error(
						`Found ${links.length} links. Checking reachability...`,
					);
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

export function printResumeHelp() {
	console.log(resumeHelp);
}
