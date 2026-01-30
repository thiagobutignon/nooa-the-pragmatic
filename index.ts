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

	// Dynamic Command Registry
	const { loadCommands } = await import("./src/core/registry.js");
	const { join } = await import("node:path");
	// Ensure we look in src/features relative to the current file or process
	const featuresDir = join(import.meta.dir, "src/features");
	const registry = await loadCommands(featuresDir);

	const subcommand = positionals[0];
	const registeredCmd = subcommand ? registry.get(subcommand) : undefined;

	if (registeredCmd) {
		await registeredCmd.execute({ args: positionals, values, bus });
		return;
	}

	// Legacy / Unmigrated Commands fallback
	const isBridge = subcommand === "bridge";
	const isJobs = subcommand === "jobs";
	const isResume = subcommand === "resume";

	if (values.help && isResume) {
		const { runResumeCommand } = await import("./src/features/resume/cli.js");
		await runResumeCommand(values, positionals.slice(1), bus);
		return;
	}
	if (values.help && isJobs) {
		const { runJobsCommand } = await import("./src/features/jobs/cli.js");
		await runJobsCommand(values, positionals.slice(1), bus);
		return;
	}
	if (values.help && isBridge) {
		const { runBridgeCommand } = await import("./src/features/bridge/cli.js");
		await runBridgeCommand(values, positionals.slice(1), bus);
		return;
	}

	if (values.help) {
		console.log(`
Usage: nooa [flags] <subcommand> [args]

Subcommands:
  read <path>                   Read file contents.
  code <write|patch>            Code operations.
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
		const { runBridgeCommand } = await import("./src/features/bridge/cli.js");
		await runBridgeCommand(values, positionals.slice(1), bus);
		return;
	}

	if (isJobs) {
		const { runJobsCommand } = await import("./src/features/jobs/cli.js");
		await runJobsCommand(values, positionals.slice(1), bus);
		return;
	}

	const { runResumeCommand } = await import("./src/features/resume/cli.js");
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
