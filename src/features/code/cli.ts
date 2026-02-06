import { readFile, writeFile } from "node:fs/promises";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { executeDiff } from "./diff";
import { executeFormat } from "./format";
import { applyPatch } from "./patch";
import { executeRefactor } from "./refactor";
import { writeCodeFile } from "./write";

export const codeMeta: AgentDocMeta = {
	name: "code",
	description: "Code operations (write, patch, diff, format, refactor)",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const codeHelp = `
Usage: nooa code <subcommand> [args] [flags]

Code operations.

Subcommands:
  write <path>        Create or overwrite a file.
  patch <path>        Apply a unified diff.
  diff [path]         Show git diff for path or all.
  format <path>       Format a file using biome.
  refactor <path> "instruction"  Refactor a file using AI.

Flags:
  --from <path>       Read content from a file (write mode).
  --overwrite         Overwrite destination if it exists (write mode).
  --patch             Read unified diff from stdin (patch mode).
  --patch-from <path> Read unified diff from a file (patch mode).
  --patch/--patch-from cannot be combined with --from.
  --json              Output result as JSON.
  --dry-run           Do not write the file.
  -h, --help          Show help message.

Examples:
  nooa code write app.ts --from template.ts
  nooa code diff src/
  nooa code format src/index.ts
  nooa code refactor src/utils.ts "rename process to handler"
`;

export const codeSdkUsage = `
SDK Usage:
  await code.run({ action: "write", path: "app.ts", content: "hello" });
  await code.run({ action: "patch", path: "app.ts", patchText: "diff..." });
  await code.run({ action: "diff", path: "src/index.ts" });
`;

export const codeUsage = {
	cli: "nooa code <subcommand> [args] [flags]",
	sdk: "await code.run({ action: \"write\", path: \"app.ts\", content: \"...\" })",
	tui: "CodeConsole()",
};

export const codeSchema = {
	action: { type: "string", required: true },
	path: { type: "string", required: false },
	instruction: { type: "string", required: false },
	from: { type: "string", required: false },
	content: { type: "string", required: false },
	overwrite: { type: "boolean", required: false },
	"dry-run": { type: "boolean", required: false },
	patch: { type: "boolean", required: false },
	"patch-from": { type: "string", required: false },
	patchText: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const codeOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "path", type: "string" },
	{ name: "bytes", type: "number" },
	{ name: "overwritten", type: "boolean" },
	{ name: "dryRun", type: "boolean" },
	{ name: "patched", type: "boolean" },
	{ name: "output", type: "string" },
];

export const codeErrors = [
	{ code: "code.missing_action", message: "Action is required." },
	{ code: "code.missing_path", message: "Destination path is required." },
	{ code: "code.missing_input", message: "Missing input. Use --from or stdin." },
	{
		code: "code.missing_patch_input",
		message: "Missing patch input. Use --patch-from or stdin.",
	},
	{
		code: "code.patch_with_from",
		message: "--patch is mutually exclusive with --from.",
	},
	{
		code: "code.format_missing_path",
		message: "Path required for format.",
	},
	{
		code: "code.refactor_missing_args",
		message: "Path and instructions required for refactor.",
	},
	{ code: "code.runtime_error", message: "Runtime error." },
];

export const codeExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const codeExamples = [
	{ input: "nooa code write app.ts --from template.ts", output: "Writes file" },
	{ input: "nooa code patch app.ts --patch-from fix.patch", output: "Patches file" },
	{ input: "nooa code diff src/", output: "Git diff output" },
];

export type CodeAction = "write" | "patch" | "diff" | "format" | "refactor" | "help";

export interface CodeRunInput {
	action?: CodeAction;
	path?: string;
	instruction?: string;
	from?: string;
	content?: string;
	overwrite?: boolean;
	"dry-run"?: boolean;
	patch?: boolean;
	"patch-from"?: string;
	patchText?: string;
	json?: boolean;
}

export interface CodeRunResult {
	mode: CodeAction;
	path?: string;
	bytes?: number;
	overwritten?: boolean;
	dryRun?: boolean;
	patched?: boolean;
	output?: string;
}

export async function run(
	input: CodeRunInput,
): Promise<SdkResult<CodeRunResult>> {
	const action = input.action;

	if (!action) {
		return { ok: false, error: sdkError("code.missing_action", "Action is required.") };
	}

	if (!["write", "patch", "diff", "format", "refactor"].includes(action)) {
		return { ok: true, data: { mode: "help", output: codeHelp } };
	}

	if (action === "diff") {
		const diff = await executeDiff(input.path);
		return { ok: true, data: { mode: "diff", path: input.path, output: diff } };
	}

	if (action === "format") {
		if (!input.path) {
			return {
				ok: false,
				error: sdkError("code.format_missing_path", "Path required for format."),
			};
		}
		const output = await executeFormat(input.path);
		return { ok: true, data: { mode: "format", path: input.path, output } };
	}

	if (action === "refactor") {
		if (!input.path || !input.instruction) {
			return {
				ok: false,
				error: sdkError(
					"code.refactor_missing_args",
					"Path and instructions required for refactor.",
				),
			};
		}
		const output = await executeRefactor(input.path, input.instruction);
		return { ok: true, data: { mode: "refactor", path: input.path, output } };
	}

	if (!input.path) {
		return {
			ok: false,
			error: sdkError("code.missing_path", "Destination path is required."),
		};
	}

	const isPatchMode =
		action === "patch" || Boolean(input.patch || input["patch-from"]);

	if (isPatchMode && input.from) {
		return {
			ok: false,
			error: sdkError(
				"code.patch_with_from",
				"--patch is mutually exclusive with --from.",
			),
		};
	}

	const { getStdinText } = await import("../../core/io");

	try {
		if (isPatchMode) {
			let patchText = input.patchText ?? "";
			if (!patchText) {
				if (input["patch-from"]) {
					patchText = await readFile(String(input["patch-from"]), "utf-8");
				} else {
					patchText = await getStdinText();
				}
			}

			if (!patchText) {
				return {
					ok: false,
					error: sdkError(
						"code.missing_patch_input",
						"Missing patch input. Use --patch-from or stdin.",
					),
				};
			}

			const originalText = await readFile(input.path, "utf-8");
			const content = applyPatch(originalText, patchText);
			if (!input["dry-run"]) {
				await writeFile(input.path, content, "utf-8");
			}

			return {
				ok: true,
				data: {
					mode: "patch",
					path: input.path,
					bytes: Buffer.byteLength(content),
					overwritten: true,
					dryRun: Boolean(input["dry-run"]),
					patched: true,
				},
			};
		}

		let content = input.content ?? "";
		if (!content && input.from) {
			content = await readFile(String(input.from), "utf-8");
		}
		if (!content) {
			content = await getStdinText();
		}
		if (!content) {
			return {
				ok: false,
				error: sdkError("code.missing_input", "Missing input. Use --from or stdin."),
			};
		}

		const result = await writeCodeFile({
			path: input.path,
			content,
			overwrite: Boolean(input.overwrite),
			dryRun: Boolean(input["dry-run"]),
		});

		return {
			ok: true,
			data: {
				mode: "write",
				path: result.path,
				bytes: result.bytes,
				overwritten: result.overwritten,
				dryRun: Boolean(input["dry-run"]),
				patched: false,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("code.runtime_error", message, { error: message }),
		};
	}
}

const codeBuilder = new CommandBuilder<CodeRunInput, CodeRunResult>()
	.meta(codeMeta)
	.usage(codeUsage)
	.schema(codeSchema)
	.help(codeHelp)
	.sdkUsage(codeSdkUsage)
	.outputFields(codeOutputFields)
	.examples(codeExamples)
	.errors(codeErrors)
	.exitCodes(codeExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			from: { type: "string" },
			overwrite: { type: "boolean" },
			"dry-run": { type: "boolean" },
			patch: { type: "boolean" },
			"patch-from": { type: "string" },
			content: { type: "string" },
		},
	})
	.parseInput(async ({ values, positionals }) => {
		const action = positionals[1] as CodeAction | undefined;
		return {
			action,
			path: positionals[2],
			instruction: positionals[3], // Only for refactor
			from: values.from as string | undefined,
			content: (values.content as string | undefined) ?? (action === "write" ? positionals[3] : undefined),
			overwrite: Boolean(values.overwrite),
			"dry-run": Boolean(values["dry-run"]),
			patch: Boolean(values.patch),
			"patch-from": values["patch-from"] as string | undefined,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (output.mode === "help") {
			console.log(output.output ?? codeHelp);
			return;
		}

		if (values.json) {
			if (output.mode === "write" || output.mode === "patch") {
				renderJson({
					path: output.path,
					bytes: output.bytes,
					overwritten: output.overwritten,
					dryRun: output.dryRun,
					mode: output.mode,
					patched: Boolean(output.patched),
				});
				return;
			}
			renderJson(output);
			return;
		}

		if (output.output) {
			console.log(output.output);
		}
	})
	.onFailure((error) => {
		handleCommandError(error, [
			"code.missing_action",
			"code.missing_path",
			"code.missing_input",
			"code.missing_patch_input",
			"code.patch_with_from",
			"code.format_missing_path",
			"code.refactor_missing_args",
		]);
	})
	.telemetry({
		eventPrefix: "code",
		successMetadata: (input, output) => ({
			action: input.action,
			mode: output.mode,
			path: output.path,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			path: input.path,
			error: error.message,
		}),
	});

export const codeAgentDoc = codeBuilder.buildAgentDoc(false);
export const codeFeatureDoc = (includeChangelog: boolean) =>
	codeBuilder.buildFeatureDoc(includeChangelog);

export default codeBuilder.build();
