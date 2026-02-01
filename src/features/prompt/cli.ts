import { join } from "node:path";
import type { Command, CommandContext } from "../../core/command";
import { PromptEngine } from "./engine";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

const promptHelp = `
Usage: nooa prompt <list|view|validate|render> [name] [flags]

Manage and render versioned AI prompts.

Subcommands:
  list                List all available prompts.
  view <name>         View a specific prompt's metadata and body.
  validate <name|--all> Check if prompt templates are valid.
  render <name>       Render a prompt with variables.

Flags:
  --var key=value     Variable for rendering (can be used multiple times).
  --json              Output as JSON.
  --all               Operate on all prompts (used with validate).
  -h, --help          Show help message.

Examples:
  nooa prompt list
  nooa prompt view review --json
  nooa prompt render review --var input="some code"
`;

const promptCommand: Command = {
	name: "prompt",
	description: "Manage and render AI prompts",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				var: { type: "string", multiple: true },
				json: { type: "boolean" },
				all: { type: "boolean" },
				help: { type: "boolean", short: "h" },
				"debug-injection": { type: "boolean" },
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		if (values.help) {
			console.log(promptHelp);
			return;
		}

		const action = positionals[1];
		const name = positionals[2];
		const traceId = createTraceId();
		logger.setContext({ trace_id: traceId, command: "prompt", action });

		// In development, we use the local path. 
		// In production, this might be bundled or point to a known location.
		const templatesDir = join(process.cwd(), "src/features/prompt/templates");
		const engine = new PromptEngine(templatesDir);

		try {
			if (action === "list") {
				const prompts = await engine.listPrompts();
				if (values.json) {
					console.log(JSON.stringify({
						schemaVersion: "1.0",
						ok: true,
						traceId,
						prompts
					}, null, 2));
				} else {
					console.log("Available Prompts:");
					for (const p of prompts) {
						console.log(`- ${p.name} (v${p.version}): ${p.description}`);
					}
				}
			} else if (action === "view" || action === "validate") {
                const validateAll = action === "validate" && (name === "--all" || values.all);
				if (!name && !validateAll) throw new Error("Prompt name is required.");
				
                if (validateAll) {
                    const prompts = await engine.listPrompts();
                    if (values.json) {
                        console.log(JSON.stringify({ 
                            schemaVersion: "1.0",
                            ok: true, 
                            traceId,
                            results: prompts.map(p => ({ name: p.name, valid: true }))
                        }, null, 2));
                    } else {
                        console.log("All prompts are valid.");
                    }
                } else {
                    const prompt = await engine.loadPrompt(name!);
                    if (action === "view") {
                        if (values.json) {
                            console.log(JSON.stringify({
                                schemaVersion: "1.0",
                                ok: true,
                                traceId,
                                prompt
                            }, null, 2));
                        } else {
                            console.log(`--- ${prompt.metadata.name} (v${prompt.metadata.version}) ---`);
                            console.log(prompt.body);
                        }
                    } else {
                        if (values.json) {
                            console.log(JSON.stringify({ 
                                schemaVersion: "1.0",
                                ok: true, 
                                traceId,
                                metadata: prompt.metadata 
                            }, null, 2));
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
				const { InjectionEngine } = await import("./injection");
				const injectionEngine = new InjectionEngine();
				const { content: injectedContext, meta: injectionMeta } = await injectionEngine.getInjectedContext();

				const rendered = engine.renderPrompt(prompt, vars, { injectedContext });
				
				if (values.json) {
					console.log(JSON.stringify({ 
						schemaVersion: "1.0",
						ok: true,
						traceId,
						metadata: prompt.metadata, 
						rendered,
						injection: values["debug-injection"] ? injectionMeta : undefined
					}, null, 2));
				} else {
					if (values["debug-injection"]) {
						console.log("--- Injection Meta ---");
						console.log(JSON.stringify(injectionMeta, null, 2));
						console.log("----------------------\n");
					}
					console.log(rendered);
				}
			} else {
				if (values.json) {
					console.log(JSON.stringify({ 
						schemaVersion: "1.0",
						ok: false, 
						traceId,
						error: "Missing or unknown subcommand", 
						usage: "nooa prompt <list|view|validate|render>" 
					}, null, 2));
				} else {
					console.log(promptHelp);
				}
				process.exitCode = 2;
				return;
			}

			telemetry.track({
				event: `prompt.${action}.success`,
				level: "info",
				success: true,
				trace_id: traceId,
				metadata: { name, action },
			}, bus);

		} catch (error: any) {
			const message = error.message;
			if (values.json) {
				console.log(JSON.stringify({ ok: false, error: message }, null, 2));
			} else {
				console.error(`Error: ${message}`);
			}
			telemetry.track({
				event: `prompt.${action}.failure`,
				level: "error",
				success: false,
				trace_id: traceId,
				metadata: { error: message, name, action },
			}, bus);
			process.exitCode = 1;
		} finally {
			logger.clearContext();
		}
	},
};

export default promptCommand;
