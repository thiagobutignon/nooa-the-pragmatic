import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import type { EventBus } from "../../core/event-bus";
import { logger } from "../../core/logger";
import { executeScaffold } from "./execute";

export async function scaffoldCli(args: string[], bus?: EventBus) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			json: { type: "boolean" },
			"dry-run": { type: "boolean" },
			force: { type: "boolean" },
			out: { type: "string" },
			"with-docs": { type: "boolean" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	const scaffoldHelp = `
Usage: nooa scaffold <command|prompt> <name> [flags]

Standardize creation of new features and prompts.

Arguments:
  <command|prompt>    Type of item to scaffold.
  <name>              Name of the item.

Flags:
  --dry-run      Log planned operations without writing to disk.
  --force        Allow overwriting existing files.
  --json         Output result as structured JSON.
  --out <file>   Write results report to a specific file.
  --with-docs    Generate documentation template.
  -h, --help     Show help message.

Examples:
  nooa scaffold command authentication
  nooa scaffold prompt review --with-docs
`;

	if (values.help) {
		console.log(scaffoldHelp);
		return;
	}

	const type = positionals[0] as "command" | "prompt";
	const name = positionals[1];

	if (!type || !name || !["command", "prompt"].includes(type)) {
		console.error("Error: Missing or invalid arguments.");
		console.log(scaffoldHelp);
		process.exitCode = 2;
		return;
	}

	try {
		const { results, traceId } = await executeScaffold(
			{
				type,
				name,
				force: !!values.force,
				dryRun: !!values["dry-run"],
				withDocs: !!values["with-docs"],
			},
			bus,
		);

		const output = {
			schemaVersion: "1.0",
			ok: true,
			traceId,
			command: "scaffold",
			timestamp: new Date().toISOString(),
			kind: type,
			name: name,
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
			console.log(`\n✅ Scaffold success (${traceId})`);
			if (values["dry-run"])
				console.log("[DRY RUN CALLBACK] No files were actually written.");
			console.log(`Created ${type}: ${name}`);
			results.forEach((f) => {
				console.log(`  - ${f}`);
			});

			if (!values["dry-run"]) {
				console.log("\nNext Steps:");
				if (type === "command") {
					console.log(`  1. Run tests: bun test src/features/${name}`);
					console.log(`  2. Check help: bun index.ts ${name} --help`);
				} else {
					console.log(
						`  1. Validate prompt: bun index.ts prompt validate ${name}`,
					);
				}
			}
		}
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		const { trace_id: traceId } = logger.getContext();
		if (values.json) {
			console.log(
				JSON.stringify(
					{
						schemaVersion: "1.0",
						ok: false,
						traceId,
						command: "scaffold",
						timestamp: new Date().toISOString(),
						error: err.message,
					},
					null,
					2,
				),
			);
		} else {
			if (
				err.message.includes("Invalid name") ||
				err.message.includes("already exists")
			) {
				console.error(`❌ Validation Error: ${err.message}`);
			} else {
				console.error(`❌ Runtime Error: ${err.message}`);
			}
		}
		process.exitCode =
			err.message.includes("Invalid name") ||
			err.message.includes("already exists")
				? 2
				: 1;
	}
}

const scaffoldCommand: Command = {
	name: "scaffold",
	description: "Standardize creation of new features and prompts",
	async execute({ rawArgs, bus }: CommandContext) {
		const index = rawArgs.indexOf("scaffold");
		await scaffoldCli(rawArgs.slice(index + 1), bus);
	},
};

export default scaffoldCommand;
