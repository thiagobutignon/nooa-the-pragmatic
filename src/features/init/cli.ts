import * as readline from "node:readline/promises";
import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import type { EventBus } from "../../core/event-bus";
import { logger } from "../../core/logger";
import { executeInit } from "./execute";

export async function initCli(args: string[], bus?: EventBus) {
	const { values } = parseArgs({
		args,
		options: {
			json: { type: "boolean" },
			"dry-run": { type: "boolean" },
			force: { type: "boolean" },
			name: { type: "string" },
			vibe: { type: "string" },
			"user-name": { type: "string" },
			root: { type: "string" },
			"non-interactive": { type: "boolean" },
			out: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
		strict: false,
	});

	const initHelp = `
Usage: nooa init [flags]

Initialize NOOA's Agentic Soul and Identity.

Flags:
  --name <name>         Name of the agent (default: NOOA).
  --vibe <vibe>         Vibe of the agent (snarky, protocol, resourceful).
  --user-name <name>    What the agent should call you.
  --root <path>         Project root directory.
  --force               Overwrite existing configuration.
  --non-interactive     Skip interactive prompts.
  --json                Output results as JSON.
  -h, --help            Show help message.

Examples:
  nooa init
  nooa init --name "NOOA-Pragmatic" --vibe "snarky" --non-interactive
`;

	if (values.help) {
		console.log(initHelp);
		return;
	}

	let name = values.name;
	let vibe = values.vibe;
	let userName = values["user-name"];

	if (!values["non-interactive"]) {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		console.log("\n✨ Initializing NOOA Agentic Soul...");

		if (!name) {
			name =
				(await rl.question("What should I be called? (default: NOOA): ")) ||
				"NOOA";
		}
		if (!vibe) {
			vibe =
				(await rl.question(
					"What is my vibe? (snarky, protocol, resourceful) (default: resourceful): ",
				)) || "resourceful";
		}
		if (!userName) {
			userName =
				(await rl.question(
					"And what should I call you? (default: Developer): ",
				)) || "Developer";
		}

		rl.close();
	}

	try {
		const { results, traceId } = await executeInit(
			{
				name: name as string,
				vibe: vibe as string,
				userName: userName as string,
				root: (values.root as string) || undefined,
				force: !!values.force,
				dryRun: !!values["dry-run"],
			},
			bus,
		);

		const output = {
			schemaVersion: "1.0",
			ok: true,
			traceId,
			command: "init",
			timestamp: new Date().toISOString(),
			files: results,
			dryRun: !!values["dry-run"],
		};

		if (values.json) {
			const jsonOutput = JSON.stringify(output, null, 2);
			if (values.out) {
				const { writeFile } = await import("node:fs/promises");
				await writeFile(values.out as string, jsonOutput);
			} else {
				console.log(jsonOutput);
			}
		} else {
			console.log(`\n✅ Init success (${traceId})`);
			console.log(`Initialized agent: ${name} (${vibe})`);
			results.forEach((f) => {
				console.log(`  - ${f}`);
			});
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("already exists")) {
			console.error(`❌ Validation Error: ${message}`);
			process.exitCode = 2;
		} else {
			logger.error(
				"init.error",
				error instanceof Error ? error : new Error(message),
			);
			console.error(`❌ Runtime Error: ${message}`);
			process.exitCode = 1;
		}
	}
}

const initCommand: Command = {
	name: "init",
	description: "Initialize NOOA's Agentic Soul and Identity",
	async execute({ rawArgs, bus }: CommandContext) {
		const index = rawArgs.indexOf("init");
		await initCli(rawArgs.slice(index + 1), bus);
	},
};

export default initCommand;
