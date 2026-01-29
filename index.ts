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
	args: string[] = typeof Bun !== "undefined" ? Bun.argv.slice(2) : [],
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
			// Bridge Options
			op: { type: "string" },
			param: { type: "string", multiple: true },
			header: { type: "string", multiple: true },
			env: { type: "string" },
			list: { type: "boolean", short: "l" },
			// Jobs Options
			search: { type: "string", short: "s" },
			provider: { type: "string", multiple: true },
			apply: { type: "string" },
			cron: { type: "string" },
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

Subcommands:
  bridge <spec-url-or-path>    Transform a REST API into CLI commands.
    Flags for bridge:
      --op <id>          Operation ID to execute.
      --param <k=v>      Parameter in dot notation (can be used multiple times).
      --header <k=v>     Custom header (can be used multiple times).
      - --env <path>       Path to .env file for authentication.

  jobs <resume-path>    Search for jobs and match against your resume.
    Flags for jobs:
      -s, --search <q>   Search query for jobs.
      --provider <key>   Job board provider (default: arbeitnow).
      -l, --list         List saved jobs from database.
      --apply <id>       Mark a saved job as applied.
      --cron <expr>      Schedule periodic fetch (e.g., "0 * * * *").
`);
		return;
	}

	// ... version check ...
	if (values.version) {
		console.log("resume2md v1.1.0");
		return;
	}

	const inputPath = positionals[0];
	const isBridge = positionals[0] === "bridge";

	if (isBridge) {
		const specSource = positionals[1];
		if (!specSource) {
			console.error("Error: OpenAPI spec URL or path is required for bridge.");
			process.exitCode = 1;
			return;
		}

		try {
			const { loadSpec, executeBridgeRequest } = await import(
				"./src/bridge.js"
			);
			const spec = await loadSpec(specSource);

			if (values.list) {
				console.log(`\nAvailable operations in ${spec.info?.title || "API"}:`);
				for (const [path, methods] of Object.entries(spec.paths || {})) {
					for (const [method, op] of Object.entries(methods as any)) {
						const o = op as any;
						console.log(
							`  - [${method.toUpperCase()}] ${o.operationId || "no-id"} (${path}): ${o.summary || ""}`,
						);
					}
				}
				return;
			}

			if (!values.op) {
				console.error("Error: --op <operationId> is required.");
				process.exitCode = 1;
				return;
			}

			const paramsMap: Record<string, string> = {};
			for (const p of (values.param as string[]) || []) {
				const [k, v] = p.split("=");
				if (k && v) paramsMap[k] = v;
			}

			const headersMap: Record<string, string> = {};
			for (const h of (values.header as string[]) || []) {
				const [k, v] = h.split(":");
				if (k && v) headersMap[k.trim()] = v.trim();
			}

			// Add .env support if needed here (simple version)

			console.error(`🚀 Executing ${values.op}...`);
			const result = await executeBridgeRequest(spec, {
				operationId: values.op as string,
				params: paramsMap,
				headers: headersMap,
			});

			console.error(`Response [${result.status}] ${result.statusText}`);
			if (typeof result.data === "object") {
				console.log(JSON.stringify(result.data, null, 2));
			} else {
				console.log(result.data);
			}

			if (result.status >= 400) {
				process.exitCode = 1;
			}
		} catch (error: any) {
			console.error("Bridge Error:", error.message);
			process.exitCode = 1;
		}
		return;
	}

	const isJobs = positionals[0] === "jobs";
	if (isJobs) {
		try {
			const { searchAndMatchJobs, listJobs, applyToJob } = await import(
				"./src/jobs.js"
			);

			if (values.apply) {
				applyToJob(Number.parseInt(values.apply));
				return;
			}

			if (values.list) {
				const jobs = listJobs();
				console.log("\n📋 Saved Jobs (ranked by match score):");
				for (const j of jobs) {
					console.log(
						`[ID: ${j.id}] ${Math.round(j.match_score * 100)}% - ${j.title} @ ${j.company} [${j.status}]`,
					);
					console.log(`     Link: ${j.url}\n`);
				}
				return;
			}

			const resumePath = positionals[1];
			if (!resumePath || !values.search) {
				console.error("Error: 'jobs <resume-path> --search <query>' is required.");
				process.exitCode = 1;
				return;
			}

			const providers = (values.provider as string[]) || ["arbeitnow"];

			if (values.cron) {
				const { scheduleJobFetch } = await import("./src/automation.js");
				scheduleJobFetch(
					values.cron as string,
					resumePath,
					values.search as string,
					providers,
				);
				// Keep process alive for cron
				console.error("🚀 Keep-alive for scheduled tasks. Press Ctrl+C to stop.");
				// Bun.cron keeps the process alive by default, but we can add a simple interval if needed.
				return;
			}

			for (const provider of providers) {
				await searchAndMatchJobs(
					resumePath,
					values.search as string,
					provider,
				);
			}

			console.log(`\n✅ Done! Found matches across ${providers.length} providers.`);
			console.log("Run 'nooa jobs --list' to see all saved jobs.");
		} catch (error: any) {
			console.error("Jobs error:", error.message);
			process.exitCode = 1;
		}
		return;
	}

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
		} else if (values["to-json-resume"]) {
			// Markdown -> JSON Resume
			const markdown = await file.text();
			const jsonResume = convertMarkdownToJsonResume(markdown);
			const outputContent = JSON.stringify(jsonResume, null, 2);
			if (values.output) {
				await writeFile(values.output, outputContent);
				console.error(`Successfully converted Markdown to JSON Resume at ${values.output}`);
			} else {
				console.log(outputContent);
			}
		} else {
			// PDF -> Markdown -> (optional) JSON Resume (default mode)
			const buffer = Buffer.from(await file.arrayBuffer());
			let markdown: string;
			try {
				markdown = await convertPdfToMarkdown(buffer, {
					linkedin: values.linkedin,
					github: values.github,
					whatsapp: values.whatsapp,
				});
			} catch (pdfError: any) {
				// If validation is requested and PDF parsing fails, maybe it's already markdown?
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

// Run if this is the main entry point
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
	main().catch((err) => {
		console.error("Fatal Error:", err);
		process.exit(1);
	});
}
