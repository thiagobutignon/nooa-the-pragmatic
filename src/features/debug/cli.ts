import { buildStandardOptions } from "../../core/cli-flags";
import { printError, renderJson, setExitCode } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { runDebug } from "./execute";

export type DebugAction =
	| "launch"
	| "capture"
	| "inspect-at"
	| "inspect-on-failure"
	| "inspect-test-failure"
	| "attach"
	| "status"
	| "stop"
	| "break"
	| "break-ls"
	| "break-rm"
	| "continue"
	| "step"
	| "state"
	| "vars"
	| "stack"
	| "eval"
	| "help";

export const debugMeta: AgentDocMeta = {
	name: "debug",
	description: "Agent-first runtime debugging with atomic evidence capture",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const debugHelp = `
Usage: nooa debug <subcommand> [args] [flags]

Agent-first runtime debugging with atomic evidence capture.

Agent-first commands:
  capture -- <command...>       Launch, capture startup state, and stop
  inspect-at <file>:<line> -- <command...>
                               Launch, run to a location, capture state, and stop
  inspect-on-failure -- <command...>
                               Launch, pause on uncaught exception, capture state, and stop
  inspect-test-failure -- <command...>
                               Run a test command, capture failure evidence, and stop

Interactive session commands (experimental):
  launch [--brk] <command...>   Start a new debug session
  attach <pid|port|ws-url>      Attach to an existing target
  status                        Show current session status
  stop                          Stop the active debug session
  break <file>:<line>           Set a breakpoint
  break-ls                      List breakpoints
  break-rm <BP#|all>            Remove breakpoints
  continue                      Resume execution
  step [over|into|out]          Step execution
  state                         Show paused state snapshot
  vars                          Show local variables
  stack                         Show call stack
  eval <expression>             Evaluate an expression in the paused frame

Flags:
  --json                        Output JSON
  -h, --help                    Show help message

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  debug.missing_subcommand: Missing subcommand
`;

export const debugUsage = {
	cli: "nooa debug <subcommand> [args] [flags]",
	sdk: 'await debug.run({ action: "status" })',
	tui: "DebugConsole()",
};

export const debugSdkUsage = `
SDK Usage:
  await debug.run({ action: "status" });
  await debug.run({ action: "capture", command: ["node", "app.js"] });
  await debug.run({ action: "inspect-at", target: "src/app.ts:42", command: ["node", "app.js"] });
  await debug.run({ action: "inspect-on-failure", command: ["node", "app.js"] });
  await debug.run({ action: "inspect-test-failure", command: ["bun", "test", "path/to/test.ts"] });
  await debug.run({ action: "help" });
`;

export const debugSchema = {
	action: { type: "string", required: true },
	json: { type: "boolean", required: false },
	brk: { type: "boolean", required: false },
	command: { type: "array", required: false },
	target: { type: "string", required: false },
	expression: { type: "string", required: false },
	session: { type: "string", required: false },
} satisfies SchemaSpec;

export const debugOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "session", type: "string" },
	{ name: "runtime", type: "string" },
	{ name: "state", type: "string" },
	{ name: "source", type: "array" },
	{ name: "vars", type: "array" },
	{ name: "stack", type: "array" },
	{ name: "breakpoints", type: "string" },
	{ name: "exception", type: "object" },
	{ name: "result", type: "string" },
	{ name: "raw", type: "string" },
];

export const debugExamples = [
	{
		input: "nooa debug capture -- node app.js",
		output: "Capture a startup snapshot for an agent and stop.",
	},
	{
		input: "nooa debug inspect-at src/app.ts:42 -- node app.js",
		output: "Run to a location and capture a paused snapshot for an agent.",
	},
	{
		input: "nooa debug inspect-on-failure -- node app.js",
		output: "Run until an uncaught failure and capture the paused state for an agent.",
	},
	{
		input: "nooa debug inspect-test-failure -- bun test path/to/test.ts",
		output: "Run a test command and capture failure evidence for an agent.",
	},
	{
		input: "nooa debug launch --brk node app.js",
		output: "Start an experimental interactive debug session.",
	},
	{
		input: "nooa debug state",
		output: "Show the current paused source, locals, and stack.",
	},
];

export const debugErrors = [
	{ code: "debug.missing_subcommand", message: "Missing subcommand." },
	{ code: "debug.no_active_session", message: "No active debug session." },
	{ code: "debug.invalid_target", message: "Unsupported or missing runtime command." },
	{ code: "debug.launch_failed", message: "Failed to launch debug target." },
	{ code: "debug.invalid_breakpoint", message: "Invalid breakpoint target." },
];

export const debugExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export interface DebugRunInput {
	action?: DebugAction;
	json?: boolean;
	brk?: boolean;
	command?: string[];
	target?: string;
	expression?: string;
	cwd?: string;
	session?: string;
}

export interface DebugRunResult {
	mode: string;
	session?: string;
	runtime?: string;
	state?: string;
	source?: string[];
	vars?: Array<{ ref: string; name: string; value: string; scope?: string }>;
	stack?: Array<{ ref: string; name: string; file: string; line: number; column?: number }>;
	breakpoints?: Array<{ ref: string; file: string; line: number; column?: number }>;
	exception?: { reason: string; message?: string };
	result?: { ref: string; value: string };
	target?: {
		command: string[];
		pid?: number;
		wsUrl?: string;
	};
	raw?: string;
}

export async function debugRun(
	input: DebugRunInput,
): Promise<SdkResult<DebugRunResult>> {
	if (!input.action) {
		return {
			ok: false,
			error: sdkError("debug.missing_subcommand", "Missing subcommand."),
		};
	}

	if (input.action === "help") {
		return {
			ok: true,
			data: {
				mode: "help",
				raw: debugHelp,
			},
		};
	}

	return await runDebug(input);
}

const debugBuilder = new CommandBuilder<DebugRunInput, DebugRunResult>()
	.meta(debugMeta)
	.usage(debugUsage)
	.schema(debugSchema)
	.help(debugHelp)
	.sdkUsage(debugSdkUsage)
	.outputFields(debugOutputFields)
	.examples(debugExamples)
	.errors(debugErrors)
	.exitCodes(debugExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			brk: { type: "boolean" },
		},
		strict: false,
	})
	.parseInput(async ({ values, positionals }) => {
		const action = (positionals[1] as DebugAction | undefined) ?? undefined;
		const command =
			action === "launch"
				? positionals.slice(2)
				: action === "capture"
					? positionals.slice(2)
					: action === "inspect-at"
						? positionals.slice(3)
						: action === "inspect-on-failure"
							? positionals.slice(2)
							: action === "inspect-test-failure"
								? positionals.slice(2)
								: undefined;
		const target =
			action === "break" || action === "break-rm" || action === "inspect-at"
				? positionals[2]
				: undefined;
		const expression = action === "eval" ? positionals.slice(2).join(" ") : undefined;

		return {
			action,
			json: Boolean(values.json),
			brk: Boolean(values.brk),
			command,
			target,
			expression,
			cwd: process.env.NOOA_CWD ?? process.cwd(),
		};
	})
	.run(debugRun)
	.onFailure((error) => {
		printError(error);
		setExitCode(error, ["debug.missing_subcommand"]);
	})
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}

		if (output.mode === "help" && output.raw) {
			console.log(output.raw);
			return;
		}

		if (output.raw) {
			console.log(output.raw);
			return;
		}

		if (output.mode === "launch") {
			console.log(
				`Session "${output.session ?? "default"}" started` +
				(output.target?.pid ? ` (pid ${output.target.pid})` : ""),
			);
			return;
		}

		if (output.mode === "stop") {
			console.log(output.raw ?? `Session "${output.session ?? "default"}" stopped`);
			return;
		}

		if (output.mode === "break" && output.breakpoints?.[0]) {
			const last = output.breakpoints[output.breakpoints.length - 1];
			console.log(
				`${last?.ref} set at ${last?.file}:${last?.line}${last?.column ? `:${last.column}` : ""}`,
			);
			return;
		}

		if (output.mode === "break-ls") {
			if (!output.breakpoints?.length) {
				console.log("No breakpoints set");
				return;
			}
			for (const bp of output.breakpoints) {
				console.log(
					`${bp.ref} ${bp.file}:${bp.line}${bp.column ? `:${bp.column}` : ""}`,
				);
			}
			return;
		}

		if (output.mode === "eval" && output.result) {
			console.log(`${output.result.ref}  ${output.result.value}`);
			return;
		}
	});

export const debugAgentDoc = debugBuilder.buildAgentDoc(false);
export const debugFeatureDoc = (includeChangelog: boolean) =>
	debugBuilder.buildFeatureDoc(includeChangelog);

export default debugBuilder.build();
