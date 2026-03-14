#!/usr/bin/env bun
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { parseArgs } from "node:util";
import type { Command } from "./src/core/command";
import type { EventBus } from "./src/core/event-bus";

type MainDeps = {
	createBus: () => EventBus;
	loadCommandByName: (
		featuresDir: string,
		name: string,
	) => Promise<Command | undefined>;
	loadCommands: (featuresDir: string) => Promise<{
		get: (name: string) => Command | undefined;
		list: () => Command[];
	}>;
	runWithContext: (
		context: Record<string, unknown>,
		fn: () => Promise<void>,
	) => Promise<void>;
	createTraceId: () => string;
	autoReflect: (
		commandName: string,
		args: string[],
		result: unknown,
	) => Promise<void>;
	openAliasDb: (path: string) => { close: () => void };
	createAliasRegistry: (
		db: ReturnType<MainDeps["openAliasDb"]>,
	) => { aliasGet: (name: string) => Promise<{ command: string; args?: string[] } | undefined> };
};

async function resolveMainDeps(
	overrides: Partial<MainDeps> = {},
): Promise<MainDeps> {
	const { EventBus } = await import("./src/core/event-bus.js");
	const { loadCommandByName, loadCommands } = await import(
		"./src/core/registry.js"
	);
	const { logger, createTraceId } = await import("./src/core/logger.js");
	const { autoReflect } = await import("./src/core/reflection/hook.ts");
	const { Database } = await import("bun:sqlite");
	const { Registry: McpRegistry } = await import("./src/core/mcp/Registry.js");

	return {
		createBus: () => new EventBus(),
		loadCommandByName,
		loadCommands,
		runWithContext: (context, fn) => logger.runWithContext(context, fn),
		createTraceId,
		autoReflect,
		openAliasDb: (path) => new Database(path),
		createAliasRegistry: (db) => new McpRegistry(db),
		...overrides,
	};
}

async function resolveFeaturesDir(): Promise<string> {
	const { join } = await import("node:path");
	const candidates = [
		join(import.meta.dir, "src/features"),
		join(process.cwd(), "src/features"),
	];

	for (const candidate of candidates) {
		try {
			await access(candidate, constants.F_OK);
			return candidate;
		} catch {}
	}

	return candidates[0];
}

// ... existing main function signature ...
export async function main(
	args: string[] = typeof Bun !== "undefined" ? Bun.argv.slice(2) : [],
	depsOverrides: Partial<MainDeps> = {},
) {
	const deps = await resolveMainDeps(depsOverrides);

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

	const bus = deps.createBus();
	bus.on("cli.error", (payload) => {
		if (values.json) console.log(JSON.stringify(payload, null, 2));
	});

	const featuresDir = await resolveFeaturesDir();
	const subcommand = positionals[0];
	const directCommand = subcommand
		? await deps.loadCommandByName(featuresDir, subcommand)
		: undefined;

	const executeCommand = async (commandName: string, command: Command) => {
		const traceId = deps.createTraceId();

		await deps.runWithContext(
			{ trace_id: traceId, command: commandName },
			async () => {
				const result: unknown = await command.execute({
					args: positionals,
					values,
					rawArgs: args,
					bus,
				});

				if (process.env.NOOA_DISABLE_REFLECTION !== "1") {
					await deps.autoReflect(commandName, args, result);
				}
			},
		);
	};

	if (directCommand && subcommand) {
		await executeCommand(subcommand, directCommand);
		return;
	}

	if (values.help || !subcommand) {
		const commandRegistry = await deps.loadCommands(featuresDir);
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

	const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
	const aliasDb = deps.openAliasDb(dbPath);

	try {
		const aliasRegistry = deps.createAliasRegistry(aliasDb);
		const aliasEntry = await aliasRegistry.aliasGet(subcommand);
		if (aliasEntry) {
			const aliasArgs = [
				aliasEntry.command,
				...(aliasEntry.args ?? []),
				...positionals.slice(1),
			];
			return main(aliasArgs, depsOverrides);
		}

		const commandRegistry = await deps.loadCommands(featuresDir);
		const registeredCmd = commandRegistry.get(subcommand);
		if (registeredCmd) {
			await executeCommand(subcommand, registeredCmd);
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
