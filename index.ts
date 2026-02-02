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
		strict: false, // Allow other flags to pass through to subcommands
		allowPositionals: true,
	});

	const { EventBus } = await import("./src/core/event-bus.js");
	const bus = new EventBus();
	bus.on("cli.error", (payload) => {
		if (values.json) console.log(JSON.stringify(payload, null, 2));
	});

	// Initialize Reflection Engine (Background)
	// Initialize Reflection Engine (Background)
	// Dynamic Command Registry
	const { loadCommands } = await import("./src/core/registry.js");
	const { join } = await import("node:path");
	const { Database } = await import("bun:sqlite");
	const { Registry: McpRegistry } = await import("./src/core/mcp/Registry.js");
	// Ensure we look in src/features relative to the current file or process
	const featuresDir = join(import.meta.dir, "src/features");
	const commandRegistry = await loadCommands(featuresDir);

	const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
	const aliasDb = new Database(dbPath);
	const aliasRegistry = new McpRegistry(aliasDb);

	const subcommand = positionals[0];
	const registeredCmd = subcommand
		? commandRegistry.get(subcommand)
		: undefined;

	try {
		const aliasEntry = subcommand
			? await aliasRegistry.aliasGet(subcommand)
			: undefined;
		if (aliasEntry) {
			const aliasArgs = [
				aliasEntry.command,
				...(aliasEntry.args ?? []),
				...positionals.slice(1),
			];
			return main(aliasArgs);
		}

		if (registeredCmd && subcommand) {
			const { logger, createTraceId } = await import("./src/core/logger.js");
			const traceId = createTraceId();

			await logger.runWithContext(
				{ trace_id: traceId, command: subcommand },
				async () => {
					const result: unknown = await registeredCmd.execute({
						args: positionals,
						values,
						rawArgs: args,
						bus,
					});

					// Auto-Reflection Hook (Lightweight Observation)
					if (process.env.NOOA_DISABLE_REFLECTION !== "1") {
						const { autoReflect } = await import(
							"./src/core/reflection/hook.ts"
						);
						await autoReflect(subcommand, args, result);
					}
				},
			);
			return;
		}

		if (values.help || !subcommand) {
			const commands = commandRegistry.list();
			const subcommandHelp = commands
				.map((cmd) => `  ${cmd.name.padEnd(25)} ${cmd.description || ""}`)
				.join("\n");

			console.log(`
Usage: nooa [flags] <subcommand> [args]

Subcommands:
${subcommandHelp}

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
	} finally {
		aliasDb.close();
	}
}

// Run if this is the main entry point
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
	main().catch((err) => {
		console.error("Fatal Error:", err);
		process.exit(1);
	});
}
