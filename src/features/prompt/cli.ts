import { join } from "node:path";
import type { Command, CommandContext } from "../../core/command";
import { getStdinText } from "../../core/io";
import { logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { PromptEngine } from "./engine";
import {
	createPrompt,
	deletePrompt,
	editPrompt,
	publishPrompt,
} from "./service";

const promptHelp = `
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
`;

const promptCommand: Command = {
	name: "prompt",
	description: "Manage and render AI prompts",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const parsed = parseArgs({
			args: rawArgs,
			options: {
				var: { type: "string", multiple: true },
				json: { type: "boolean" },
				all: { type: "boolean" },
				body: { type: "string" },
				description: { type: "string" },
				output: { type: "string" },
				patch: { type: "boolean" },
				level: { type: "string" },
				note: { type: "string" },
				help: { type: "boolean", short: "h" },
				"debug-injection": { type: "boolean" },
			},
			strict: true,
			allowPositionals: true,
		});
		const values = parsed.values as {
			var?: string[];
			json?: boolean;
			all?: boolean;
			body?: string;
			description?: string;
			output?: string;
			patch?: boolean;
			level?: string;
			note?: string;
			help?: boolean;
			"debug-injection"?: boolean;
		};
		const positionals = parsed.positionals as string[];

		if (values.help) {
			console.log(promptHelp);
			return;
		}

		const action = positionals[1];
		const name = positionals[2];
		const { trace_id: traceId } = logger.getContext();

		// In development, we use the local path.
		// In production, this might be bundled or point to a known location.
		const templatesDir = join(process.cwd(), "src/features/prompt/templates");
		const engine = new PromptEngine(templatesDir);

		try {
			if (action === "create") {
				if (!name) throw new Error("Prompt name is required.");
				const description = values.description as string;
				if (!description) throw new Error("Missing --description for create.");
				const output = (values.output as string) || "markdown";
				if (output && !["json", "markdown"].includes(output)) {
					throw new Error("Invalid --output. Use json or markdown.");
				}
				const body = (values.body as string) || (await getStdinText());
				if (!body) throw new Error("Prompt body is required.");

				await createPrompt({
					templatesDir,
					name,
					description,
					output: output as "json" | "markdown",
					body,
				});

				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: true,
								traceId,
								name,
							},
							null,
							2,
						),
					);
				} else {
					console.log(`Prompt '${name}' created.`);
				}
			} else if (action === "edit") {
				if (!name) throw new Error("Prompt name is required.");
				if (!values.patch) throw new Error("Missing --patch for edit.");
				const patch = await getStdinText();
				if (!patch) throw new Error("Patch input is required.");

				await editPrompt({ templatesDir, name, patch });
				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: true,
								traceId,
								name,
							},
							null,
							2,
						),
					);
				} else {
					console.log(`Prompt '${name}' updated.`);
				}
			} else if (action === "delete") {
				if (!name) throw new Error("Prompt name is required.");
				await deletePrompt({ templatesDir, name });
				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: true,
								traceId,
								name,
							},
							null,
							2,
						),
					);
				} else {
					console.log(`Prompt '${name}' deleted.`);
				}
			} else if (action === "publish") {
				if (!name) throw new Error("Prompt name is required.");
				const level = values.level as string;
				if (!level) throw new Error("Missing --level for publish.");
				if (!["patch", "minor", "major"].includes(level)) {
					throw new Error("Invalid --level. Use patch, minor, or major.");
				}
				const note = (values.note as string) || (await getStdinText());
				if (!note) throw new Error("Changelog note is required.");

				const next = await publishPrompt({
					templatesDir,
					name,
					level: level as "patch" | "minor" | "major",
					changelogPath: join(
						process.cwd(),
						"src/features/prompt/CHANGELOG.md",
					),
					note,
				});
				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: true,
								traceId,
								name,
								version: next,
							},
							null,
							2,
						),
					);
				} else {
					console.log(`Prompt '${name}' published as v${next}.`);
				}
			} else if (action === "list") {
				const prompts = await engine.listPrompts();
				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: true,
								traceId,
								prompts,
							},
							null,
							2,
						),
					);
				} else {
					console.log("Available Prompts:");
					for (const p of prompts) {
						console.log(`- ${p.name} (v${p.version}): ${p.description}`);
					}
				}
			} else if (action === "view" || action === "validate") {
				const validateAll =
					action === "validate" && (name === "--all" || values.all);
				if (!name && !validateAll) throw new Error("Prompt name is required.");

				if (validateAll) {
					const prompts = await engine.listPrompts();
					if (values.json) {
						console.log(
							JSON.stringify(
								{
									schemaVersion: "1.0",
									ok: true,
									traceId,
									results: prompts.map((p) => ({ name: p.name, valid: true })),
								},
								null,
								2,
							),
						);
					} else {
						console.log("All prompts are valid.");
					}
				} else {
					if (!name) throw new Error("Prompt name is required.");
					const prompt = await engine.loadPrompt(name);
					if (action === "view") {
						if (values.json) {
							console.log(
								JSON.stringify(
									{
										schemaVersion: "1.0",
										ok: true,
										traceId,
										prompt,
									},
									null,
									2,
								),
							);
						} else {
							console.log(
								`--- ${prompt.metadata.name} (v${prompt.metadata.version}) ---`,
							);
							console.log(prompt.body);
						}
					} else {
						if (values.json) {
							console.log(
								JSON.stringify(
									{
										schemaVersion: "1.0",
										ok: true,
										traceId,
										metadata: prompt.metadata,
									},
									null,
									2,
								),
							);
						} else {
							console.log(`Prompt '${name}' is valid.`);
						}
					}
				}
			} else if (action === "render") {
				if (!name) throw new Error("Prompt name is required.");
				const prompt = await engine.loadPrompt(name);
				const vars: Record<string, string> = {};
				if (values.var) {
					for (const v of values.var) {
						const [key, ...rest] = v.split("=");
						vars[key] = rest.join("=");
					}
				}
				const rendered = await engine.renderPrompt(prompt, vars);

				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: true,
								traceId,
								metadata: prompt.metadata,
								rendered,
							},
							null,
							2,
						),
					);
				} else {
					console.log(rendered);
				}
			} else {
				if (values.json) {
					console.log(
						JSON.stringify(
							{
								schemaVersion: "1.0",
								ok: false,
								traceId,
								error: "Missing or unknown subcommand",
								usage: "nooa prompt <list|view|validate|render>",
							},
							null,
							2,
						),
					);
				} else {
					console.log(promptHelp);
				}
				process.exitCode = 2;
				return;
			}

			telemetry.track(
				{
					event: `prompt.${action}.success`,
					level: "info",
					success: true,
					trace_id: traceId,
					metadata: { name, action },
				},
				bus,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const { trace_id: traceId } = logger.getContext();
			if (values.json) {
				console.log(
					JSON.stringify(
						{
							schemaVersion: "1.0",
							ok: false,
							traceId,
							command: "prompt",
							timestamp: new Date().toISOString(),
							error: message,
						},
						null,
						2,
					),
				);
			} else {
				console.error(`Error: ${message}`);
			}
			telemetry.track(
				{
					event: `prompt.${action}.failure`,
					level: "error",
					success: false,
					trace_id: traceId,
					metadata: { error: message, name, action },
				},
				bus,
			);
			process.exitCode = 1;
		}
	},
};

export default promptCommand;
