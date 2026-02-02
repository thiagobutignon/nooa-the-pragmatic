import type { Command, CommandContext } from "../../core/command";
import { executePipeline } from "./executor";
import { parsePipelineArgs } from "./parser";
import type { RunOptions } from "./types";

const runHelp = `
Usage: nooa run [flags] -- <cmd1> -- <cmd2> ...
       nooa run [flags] "cmd1" "cmd2" ...

Execute multiple commands in a pipeline.

Modes:
  1. Delimiter Mode (Recommended): Separate commands with --
     nooa run -- code write foo.ts -- commit -m "feat: foo"

  2. String Mode: Pass commands as quoted strings
     nooa run "code write foo.ts" "commit -m 'feat: foo'"

Flags:
  --continue-on-error   Continue to next step even if a step fails.
  --json                Output results as JSON (includes schemaVersion and runId).
  --capture-output      Capture stdout/stderr for each step (external commands only).
  --allow-external      Allow executing non-nooa commands (without 'exec' prefix).
  --dry-run             Parse and show plan without executing.
  -h, --help            Show help message.
`;

const runCommand: Command = {
	name: "run",
	description: "Execute multiple commands in a pipeline",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		// rawArgs contains the subcommand name as the first element (e.g. "run").
		// Strip it before parsing flags and args.
		const args = rawArgs.slice(1);
		const { randomUUID } = await import("node:crypto");

		const { flags, rest } = extractFlags(args);

		if (flags.help) {
			console.log(runHelp);
			return;
		}

		const options: RunOptions = {
			json: flags.json || false,
			captureOutput: flags.captureOutput || false,
			continueOnError: flags.continueOnError || false,
			allowExternal: flags.allowExternal || false,
			cwd: process.cwd(),
		};

		const steps = parsePipelineArgs(rest);

		if (flags.dryRun) {
			console.log(JSON.stringify(steps, null, 2));
			return;
		}

		if (steps.length === 0) {
			console.error("Error: No commands provided.");
			console.log(runHelp);
			process.exitCode = 2;
			return;
		}

		if (!options.json) {
			console.log(`Running payload with ${steps.length} steps...`);
		}
		const result = await executePipeline(steps, options, bus);

		if (options.json) {
			console.log(
				JSON.stringify(
					{
						schemaVersion: "1.0",
						runId: randomUUID(),
						ok: result.ok,
						failedStepIndex: result.failedStepIndex,
						steps: result.steps,
					},
					null,
					2,
				),
			);
		}

		if (!result.ok && result.failedStepIndex !== undefined) {
			const failedStepIndex = result.failedStepIndex;
			const failedStep = result.steps[failedStepIndex];
			if (failedStep && !options.json) {
				console.error(
					`Pipeline failed at step ${failedStepIndex + 1}: ${failedStep.step.original}`,
				);
				if (failedStep.error) console.error(failedStep.error);
			}
			process.exitCode = failedStep?.exitCode || 1;
		}
	},
};

type RunFlags = {
	help?: boolean;
	json?: boolean;
	captureOutput?: boolean;
	continueOnError?: boolean;
	allowExternal?: boolean;
	dryRun?: boolean;
};

function extractFlags(args: string[]): { flags: RunFlags; rest: string[] } {
	const flags: RunFlags = {};
	const rest: string[] = [];
	let parsingFlags = true;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === undefined) continue;

		// If we hit "--", stop parsing global flags, the rest is the pipeline
		if (arg === "--") {
			parsingFlags = false;
			// We keep the "--" so the parser knows we are in delimiter mode?
			// Actually the parser expects "--" to delimit steps. The first "--" might be the trigger.
			// Let's pass it through.
			rest.push(arg);
			continue;
		}

		if (parsingFlags && arg.startsWith("-")) {
			if (arg === "-h" || arg === "--help") flags.help = true;
			else if (arg === "--json") flags.json = true;
			else if (arg === "--capture-output") flags.captureOutput = true;
			else if (arg === "--continue-on-error") flags.continueOnError = true;
			else if (arg === "--allow-external") flags.allowExternal = true;
			else if (arg === "--dry-run") flags.dryRun = true;
			else {
				// Unknown flag, maybe part of a command?
				// If we assume flags must come first, we warn or stop.
				// But to be safe, if it's not a known flag, treat as start of command args
				parsingFlags = false;
				rest.push(arg);
			}
		} else {
			parsingFlags = false;
			rest.push(arg);
		}
	}
	return { flags, rest };
}

export default runCommand;
