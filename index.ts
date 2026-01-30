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
		},
		strict: true,
		allowPositionals: true,
	});

	const subcommand = positionals[0];
	const isBridge = subcommand === "bridge";
	const isJobs = subcommand === "jobs";
	const isResume = subcommand === "resume";

	if (values.help && isResume) {
		const { runResumeCommand } = await import("./src/cli/resume.js");
		await runResumeCommand(values, positionals.slice(1));
		return;
	}
	if (values.help && isJobs) {
		const { runJobsCommand } = await import("./src/cli/jobs.js");
		await runJobsCommand(values, positionals.slice(1));
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

	if (isJobs) {
		const { runJobsCommand } = await import("./src/cli/jobs.js");
		await runJobsCommand(values, positionals.slice(1));
		return;
	}
	const { runResumeCommand } = await import("./src/cli/resume.js");
	const resumeArgs = isResume ? positionals.slice(1) : positionals;
	await runResumeCommand(values, resumeArgs);
}

// Run if this is the main entry point
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
	main().catch((err) => {
		console.error("Fatal Error:", err);
		process.exit(1);
	});
}
