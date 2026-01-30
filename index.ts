#!/usr/bin/env bun
import { parseArgs } from "node:util";

// ... existing main function signature ...
export async function main(
	args: string[] = typeof Bun !== "undefined" ? Bun.argv.slice(2) : [],
) {
	// Step 1: Parse global flags and subcommand
	const { values, positionals } = parseArgs({
		args,
		options: {
			json: { type: "boolean" },
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
		},
		strict: false, // Allow other flags to pass through to subcommands
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
		await registeredCmd.execute({ args: positionals, values, rawArgs: args, bus });
		return;
	}

	if (values.help || !subcommand) {
		console.log(`
Usage: nooa [flags] <subcommand> [args]

Subcommands:
  read <path>                   Read file contents.
  code <write|patch>            Code operations.
  search <query> [path]         Search files and file contents.

Flags:
  --json                 Output structure as JSON.
  -v, --version          Show version.
  -h, --help             Show help.
`);
		return;
	}

	if (values.version) {
		console.log("nooa v0.0.1");
		return;
	}

	console.error(`Error: Unknown subcommand '${subcommand}'`);
	process.exitCode = 1;
}

// Run if this is the main entry point
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
	main().catch((err) => {
		console.error("Fatal Error:", err);
		process.exit(1);
	});
}
