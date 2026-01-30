#!/usr/bin/env bun
import { parseArgs } from "node:util";

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
			// Code write options
			from: { type: "string" },
			overwrite: { type: "boolean" },
			"dry-run": { type: "boolean" },
			patch: { type: "boolean" },
			"patch-from": { type: "string" },
		},
		strict: true,
		allowPositionals: true,
	});

	const { EventBus } = await import("./src/core/event-bus.js");
	const bus = new EventBus();
	bus.on("cli.error", (payload) => {
		if (values.json) console.log(JSON.stringify(payload, null, 2));
	});

	const subcommand = positionals[0];
	const isBridge = subcommand === "bridge";
	const isJobs = subcommand === "jobs";
	const isResume = subcommand === "resume";
	const isCode = subcommand === "code";
	const codeAction = positionals[1];

const codeWriteHelp = `
Usage: nooa code write <path> [flags]

Arguments:
  <path>              Destination file path.

Flags:
  --from <path>       Read content from a file (otherwise stdin is used).
  --patch             Read a unified diff from stdin and apply to <path>.
  --patch-from <path> Read a unified diff from a file and apply to <path>.
  --overwrite         Overwrite destination if it exists.
  --json              Output result as JSON.
  --dry-run           Do not write the file.
  -h, --help          Show help.

Notes:
  Mutually exclusive: --patch/--patch-from cannot be combined with --from or non-patch stdin.
`;

	if (values.help && isResume) {
		const { runResumeCommand } = await import("./src/cli/resume.js");
		await runResumeCommand(values, positionals.slice(1), bus);
		return;
	}
	if (values.help && isJobs) {
		const { runJobsCommand } = await import("./src/cli/jobs.js");
		await runJobsCommand(values, positionals.slice(1), bus);
		return;
	}
	if (values.help && isBridge) {
		const { runBridgeCommand } = await import("./src/cli/bridge.js");
		await runBridgeCommand(values, positionals.slice(1), bus);
		return;
	}
	if (values.help && isCode && codeAction === "write") {
		console.log(codeWriteHelp);
		return;
	}

	if (values.help) {
		console.log(`
Usage: nooa [flags] <subcommand> [args]

Subcommands:
  resume <input>                Convert resumes (PDF/Markdown/JSON Resume).
  bridge <spec-url-or-path>     Transform a REST API into CLI commands.
  jobs <resume-path>            Search for jobs and match against your resume.

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

Bridge flags:
  --op <id>          Operation ID to execute.
  --param <k=v>      Parameter in dot notation (can be used multiple times).
  --header <k=v>     Custom header (can be used multiple times).
  --env <path>       Path to .env file for authentication.

Jobs flags:
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
		console.log("nooa v0.0.1");
		return;
	}

	if (isBridge) {
		const { runBridgeCommand } = await import("./src/cli/bridge.js");
		await runBridgeCommand(values, positionals.slice(1), bus);
		return;
	}

	if (isJobs) {
		const { runJobsCommand } = await import("./src/cli/jobs.js");
		await runJobsCommand(values, positionals.slice(1), bus);
		return;
	}

	if (isCode && codeAction === "write") {
		const targetPath = positionals[2];
		if (!targetPath) {
			console.error("Error: Destination path is required.");
			process.exitCode = 2;
			return;
		}

		try {
			const { readFile, writeFile } = await import("node:fs/promises");
			const isPatchMode = Boolean(values.patch || values["patch-from"]);
			let content = "";
			let patched = false;

			if (isPatchMode && values.from) {
				console.error("Error: --patch is mutually exclusive with --from.");
				process.exitCode = 2;
				return;
			}

			if (isPatchMode) {
				let patchText = "";
				if (values["patch-from"]) {
					patchText = await readFile(values["patch-from"], "utf-8");
				} else if (!process.stdin.isTTY) {
					patchText = await new Response(process.stdin).text();
				}

				if (!patchText) {
					console.error("Error: Missing patch input. Use --patch-from or stdin.");
					process.exitCode = 2;
					return;
				}

				const { applyPatch } = await import("./src/code/patch.js");
				const originalText = await readFile(targetPath, "utf-8");
				content = applyPatch(originalText, patchText);
				patched = true;
				if (!values["dry-run"]) {
					await writeFile(targetPath, content, "utf-8");
				}
			} else {
				if (!values.from && !process.stdin.isTTY) {
					const stdinText = await new Response(process.stdin).text();
					if (stdinText.length > 0) {
						content = stdinText;
					}
				}

				if (!content && values.from) {
					content = await readFile(values.from, "utf-8");
				}

				if (!content) {
					console.error("Error: Missing input. Use --from or stdin.");
					process.exitCode = 2;
					return;
				}

				const { writeCodeFile } = await import("./src/code/write.js");
				const result = await writeCodeFile({
					path: targetPath,
					content,
					overwrite: Boolean(values.overwrite),
					dryRun: Boolean(values["dry-run"]),
				});

				if (values.json) {
					console.log(
						JSON.stringify(
							{
								path: result.path,
								bytes: result.bytes,
								overwritten: result.overwritten,
								dryRun: Boolean(values["dry-run"]),
								mode: "write",
								patched: false,
							},
							null,
							2,
						),
					);
				}

				return;
			}

			if (values.json) {
				console.log(
					JSON.stringify(
						{
							path: targetPath,
							bytes: Buffer.byteLength(content),
							overwritten: true,
							dryRun: Boolean(values["dry-run"]),
							mode: "patch",
							patched,
						},
						null,
						2,
					),
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Error: ${message}`);
			process.exitCode = 1;
		}
		return;
	}

	const { runResumeCommand } = await import("./src/cli/resume.js");
	const resumeArgs = isResume ? positionals.slice(1) : positionals;
	await runResumeCommand(values, resumeArgs, bus);
}

// Run if this is the main entry point
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
	main().catch((err) => {
		console.error("Fatal Error:", err);
		process.exit(1);
	});
}
