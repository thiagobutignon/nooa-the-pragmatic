#!/usr/bin/env bun
import { parseArgs } from "node:util";

// ... existing main function signature ...
export async function main(
	args: string[] = typeof Bun !== "undefined" ? Bun.argv.slice(2) : [],
) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			json: { type: "boolean" },
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
			// Code write options
			from: { type: "string" },
			overwrite: { type: "boolean" },
			"dry-run": { type: "boolean" },
			patch: { type: "boolean" },
			"patch-from": { type: "string" },
			// Worktree options
			base: { type: "string" },
			"no-install": { type: "boolean" },
			"no-test": { type: "boolean" },
			// Search options
			regex: { type: "boolean" },
			"case-sensitive": { type: "boolean" },
			"files-only": { type: "boolean" },
			"max-results": { type: "string" },
			include: { type: "string", multiple: true },
			exclude: { type: "string", multiple: true },
			plain: { type: "boolean" },
			"no-color": { type: "boolean" },
			context: { type: "string" },
			"ignore-case": { type: "boolean", short: "i" },
			count: { type: "boolean", short: "c" },
			hidden: { type: "boolean" },
		},
		strict: true,
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
		await registeredCmd.execute({ args: positionals, values, bus });
		return;
	}

	if (values.help || !subcommand) {
		console.log(`
Usage: nooa [flags] <subcommand> [args]

Subcommands:
  read <path>                   Read file contents.
  code <write|patch>            Code operations.
  search <query> [path]         Search files and file contents.
  worktree <branch>             Create a git worktree.

Flags:
  --json                 Output structure as JSON.
  -v, --version          Show version.
  -h, --help             Show help.

Code flags:
  --from <file>      Input file for write operation.
  --overwrite        Overwrite existing file.
  --dry-run          Show what would happen without writing.
  --patch            Apply a unified diff patch.
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
