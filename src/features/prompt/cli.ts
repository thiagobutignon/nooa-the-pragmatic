import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { PromptEngine } from "./engine";
import { createPrompt, deletePrompt, editPrompt, publishPrompt } from "./service";

export const promptMeta: AgentDocMeta = {
	name: "prompt",
	description: "Manage and render AI prompts",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const promptHelp = `
Usage: nooa prompt <list|view|validate|render|create|edit|delete|publish> [name] [flags]

Manage and render versioned AI prompts.

Subcommands:
  list                List all available prompts.
  view <name>         View a specific prompt's metadata and body.
  validate <name|--all> Check if prompt templates are valid.
  render <name>       Render a prompt with variables.
  create <name>       Create a new prompt template.
  edit <name>         Edit a prompt via unified diff patch (stdin).
  delete <name>       Delete a prompt template.
  publish <name>      Bump prompt version and update changelog.

Flags:
  --var key=value     Variable for rendering (can be used multiple times).
  --body <text>       Body content for create (or via stdin).
  --description <t>   Description for create.
  --output <format>   Output format for create (json|markdown).
  --patch             Read unified diff patch from stdin (edit).
  --level <l>         Publish level: patch, minor, major.
  --note <text>       Changelog note for publish (or via stdin).
  --json              Output as JSON.
  --all               Operate on all prompts (used with validate).
  -h, --help          Show help message.

Examples:
  nooa prompt list
  nooa prompt view review --json
  nooa prompt render review --var input="some code"
  nooa prompt create my-prompt --description "My Prompt" --body "Hello"
  nooa prompt edit my-prompt --patch < patch.diff
  nooa prompt publish my-prompt --level patch --note "Refined instructions"

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  prompt.missing_action: Missing subcommand
  prompt.missing_name: Prompt name required
  prompt.missing_description: Missing --description
  prompt.invalid_output: Invalid --output
  prompt.missing_body: Prompt body required
  prompt.missing_patch: Missing --patch
  prompt.missing_level: Missing --level
  prompt.invalid_level: Invalid --level
  prompt.missing_note: Missing --note
  prompt.runtime_error: Unexpected error
`;

export const promptSdkUsage = `
SDK Usage:
  const result = await prompt.run({ action: "list" });
  if (result.ok) console.log(result.data.prompts);
`;

export const promptUsage = {
	cli: "nooa prompt <list|view|validate|render|create|edit|delete|publish> [name] [flags]",
	sdk: "await prompt.run({ action: \"list\" })",
	tui: "PromptConsole()",
};

export const promptSchema = {
	action: { type: "string", required: true },
	name: { type: "string", required: false },
	var: { type: "string", required: false },
	body: { type: "string", required: false },
	description: { type: "string", required: false },
	output: { type: "string", required: false },
	patch: { type: "boolean", required: false },
	level: { type: "string", required: false },
	note: { type: "string", required: false },
	all: { type: "boolean", required: false },
	json: { type: "boolean", required: false },
	"debug-injection": { type: "boolean", required: false },
} satisfies SchemaSpec;

export const promptOutputFields = [
	{ name: "action", type: "string" },
	{ name: "name", type: "string" },
	{ name: "prompts", type: "string" },
	{ name: "prompt", type: "string" },
	{ name: "rendered", type: "string" },
	{ name: "version", type: "string" },
	{ name: "results", type: "string" },
];

export const promptErrors = [
	{ code: "prompt.missing_action", message: "Missing subcommand." },
	{ code: "prompt.missing_name", message: "Prompt name required." },
	{ code: "prompt.missing_description", message: "Missing --description." },
	{ code: "prompt.invalid_output", message: "Invalid --output." },
	{ code: "prompt.missing_body", message: "Prompt body required." },
	{ code: "prompt.missing_patch", message: "Missing --patch." },
	{ code: "prompt.missing_level", message: "Missing --level." },
	{ code: "prompt.invalid_level", message: "Invalid --level." },
	{ code: "prompt.missing_note", message: "Missing --note." },
	{ code: "prompt.runtime_error", message: "Unexpected error." },
];

export const promptExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const promptExamples = [
	{ input: "nooa prompt list", output: "List prompts" },
	{ input: "nooa prompt view review", output: "Prompt details" },
	{ input: "nooa prompt publish review --level patch --note note", output: "Publish prompt" },
];

export interface PromptRunInput {
	action?: string;
	name?: string;
	vars?: string[];
	body?: string;
	description?: string;
	output?: string;
	patch?: boolean;
	level?: string;
	note?: string;
	all?: boolean;
	json?: boolean;
	debugInjection?: boolean;
}

export interface PromptRunResult {
	action: string;
	name?: string;
	prompts?: unknown;
	prompt?: unknown;
	rendered?: string;
	version?: string;
	results?: unknown;
}

const parseVars = (vars: unknown): string[] => {
	if (Array.isArray(vars)) {
		return vars.filter((value): value is string => typeof value === "string");
	}
	if (typeof vars === "string") {
		return [vars];
	}
	return [];
};

export async function run(
	input: PromptRunInput,
): Promise<SdkResult<PromptRunResult>> {
	try {
		const action = input.action;
		if (!action) {
			return {
				ok: false,
				error: sdkError("prompt.missing_action", "Missing subcommand."),
			};
		}

		const templatesDir = join(process.cwd(), "src/features/prompt/templates");
		const engine = new PromptEngine(templatesDir);

		switch (action) {
			case "create": {
				if (!input.name) {
					return {
						ok: false,
						error: sdkError("prompt.missing_name", "Prompt name required."),
					};
				}
				if (!input.description) {
					return {
						ok: false,
						error: sdkError(
							"prompt.missing_description",
							"Missing --description.",
						),
					};
				}
				const output = input.output || "markdown";
				if (!["json", "markdown"].includes(output)) {
					return {
						ok: false,
						error: sdkError("prompt.invalid_output", "Invalid --output."),
					};
				}
				const { getStdinText } = await import("../../core/io");
				const body = input.body || (await getStdinText());
				if (!body) {
					return {
						ok: false,
						error: sdkError("prompt.missing_body", "Prompt body required."),
					};
				}
				await createPrompt({
					templatesDir,
					name: input.name,
					description: input.description,
					output: output as "json" | "markdown",
					body,
				});
				return { ok: true, data: { action, name: input.name } };
			}
			case "edit": {
				if (!input.name) {
					return {
						ok: false,
						error: sdkError("prompt.missing_name", "Prompt name required."),
					};
				}
				if (!input.patch) {
					return {
						ok: false,
						error: sdkError("prompt.missing_patch", "Missing --patch."),
					};
				}
				const { getStdinText } = await import("../../core/io");
				const patch = await getStdinText();
				if (!patch) {
					return {
						ok: false,
						error: sdkError("prompt.missing_patch", "Patch input required."),
					};
				}
				await editPrompt({ templatesDir, name: input.name, patch });
				return { ok: true, data: { action, name: input.name } };
			}
			case "delete": {
				if (!input.name) {
					return {
						ok: false,
						error: sdkError("prompt.missing_name", "Prompt name required."),
					};
				}
				await deletePrompt({ templatesDir, name: input.name });
				return { ok: true, data: { action, name: input.name } };
			}
			case "publish": {
				if (!input.name) {
					return {
						ok: false,
						error: sdkError("prompt.missing_name", "Prompt name required."),
					};
				}
				if (!input.level) {
					return {
						ok: false,
						error: sdkError("prompt.missing_level", "Missing --level."),
					};
				}
				if (!["patch", "minor", "major"].includes(input.level)) {
					return {
						ok: false,
						error: sdkError("prompt.invalid_level", "Invalid --level."),
					};
				}
				const { getStdinText } = await import("../../core/io");
				const note = input.note || (await getStdinText());
				if (!note) {
					return {
						ok: false,
						error: sdkError("prompt.missing_note", "Missing --note."),
					};
				}
				const version = await publishPrompt({
					templatesDir,
					name: input.name,
					level: input.level as "patch" | "minor" | "major",
					changelogPath: join(
						process.cwd(),
						"src/features/prompt/CHANGELOG.md",
					),
					note,
				});
				return { ok: true, data: { action, name: input.name, version } };
			}
			case "list": {
				const prompts = await engine.listPrompts();
				return { ok: true, data: { action, prompts } };
			}
			case "view":
			case "validate": {
				const validateAll =
					action === "validate" && (input.name === "--all" || input.all);
				if (!input.name && !validateAll) {
					return {
						ok: false,
						error: sdkError("prompt.missing_name", "Prompt name required."),
					};
				}

				if (validateAll) {
					const prompts = await engine.listPrompts();
					return {
						ok: true,
						data: {
							action,
							results: prompts.map((prompt) => ({
								name: prompt.name,
								valid: true,
							})),
						},
					};
				}

				const prompt = await engine.loadPrompt(input.name as string);
				if (action === "view") {
					return { ok: true, data: { action, prompt } };
				}

				return {
					ok: true,
					data: { action, name: input.name, prompt: prompt.metadata },
				};
			}
			case "render": {
				if (!input.name) {
					return {
						ok: false,
						error: sdkError("prompt.missing_name", "Prompt name required."),
					};
				}
				const prompt = await engine.loadPrompt(input.name);
				const vars: Record<string, string> = {};
				for (const pair of input.vars || []) {
					const [key, ...rest] = pair.split("=");
					vars[key] = rest.join("=");
				}
				const rendered = await engine.renderPrompt(prompt, vars);
				return { ok: true, data: { action, name: input.name, rendered } };
			}
			default:
				return {
					ok: false,
					error: sdkError("prompt.missing_action", "Missing subcommand."),
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: sdkError("prompt.runtime_error", message) };
	}
}

const promptBuilder = new CommandBuilder<PromptRunInput, PromptRunResult>()
	.meta(promptMeta)
	.usage(promptUsage)
	.schema(promptSchema)
	.help(promptHelp)
	.sdkUsage(promptSdkUsage)
	.outputFields(promptOutputFields)
	.examples(promptExamples)
	.errors(promptErrors)
	.exitCodes(promptExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			var: { type: "string", multiple: true },
			body: { type: "string" },
			description: { type: "string" },
			output: { type: "string" },
			patch: { type: "boolean" },
			level: { type: "string" },
			note: { type: "string" },
			all: { type: "boolean" },
			"debug-injection": { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		action: positionals[1],
		name: positionals[2],
		vars: parseVars(values.var),
		body: typeof values.body === "string" ? values.body : undefined,
		description:
			typeof values.description === "string" ? values.description : undefined,
		output: typeof values.output === "string" ? values.output : undefined,
		patch: Boolean(values.patch),
		level: typeof values.level === "string" ? values.level : undefined,
		note: typeof values.note === "string" ? values.note : undefined,
		all: Boolean(values.all),
		json: Boolean(values.json),
		debugInjection: Boolean(values["debug-injection"]),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}

		switch (output.action) {
			case "create":
				console.log(`Prompt '${output.name}' created.`);
				break;
			case "edit":
				console.log(`Prompt '${output.name}' updated.`);
				break;
			case "delete":
				console.log(`Prompt '${output.name}' deleted.`);
				break;
			case "publish":
				console.log(`Prompt '${output.name}' published as v${output.version}.`);
				break;
			case "list":
				console.log("Available Prompts:");
				if (Array.isArray(output.prompts)) {
					for (const prompt of output.prompts) {
						console.log(
							`- ${prompt.name} (v${prompt.version}): ${prompt.description}`,
						);
					}
				}
				break;
			case "view":
				if (output.prompt && typeof output.prompt === "object") {
					const prompt = output.prompt as { metadata?: { name?: string; version?: string }; body?: string };
					console.log(
						`--- ${prompt.metadata?.name ?? output.name} (v${prompt.metadata?.version ?? ""}) ---`,
					);
					if (prompt.body) console.log(prompt.body);
					else console.log(JSON.stringify(prompt, null, 2));
				}
				break;
			case "validate":
				if (Array.isArray(output.results)) {
					console.log("Validation Results:");
					for (const result of output.results) {
						console.log(`- ${result.name}: ${result.valid ? "valid" : "invalid"}`);
					}
				} else if (output.name) {
					console.log(`Prompt '${output.name}' is valid.`);
				}
				break;
			case "render":
				if (output.rendered) console.log(output.rendered);
				break;
			default:
				break;
		}
	})
	.onFailure((error) => {
		handleCommandError(error, [
			"prompt.missing_action",
			"prompt.missing_name",
			"prompt.missing_description",
			"prompt.invalid_output",
			"prompt.missing_body",
			"prompt.missing_patch",
			"prompt.missing_level",
			"prompt.invalid_level",
			"prompt.missing_note",
		]);
	})
	.telemetry({
		eventPrefix: "prompt",
		successMetadata: (input) => ({ action: input.action, name: input.name }),
		failureMetadata: (input, error) => ({ action: input.action, error: error.message }),
	});

export const promptAgentDoc = promptBuilder.buildAgentDoc(false);
export const promptFeatureDoc = (includeChangelog: boolean) =>
	promptBuilder.buildFeatureDoc(includeChangelog);

const promptCommand = promptBuilder.build();

export default promptCommand;
