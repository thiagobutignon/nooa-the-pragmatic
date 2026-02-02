import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";
import {
	expandHomePath,
	fileExists,
	findProjectRoot,
	loadEnvFile,
	parseEnvEntries,
	resolveEnvPath,
} from "./helpers";

export async function configureCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			command: { type: "string" },
			args: { type: "string", multiple: true },
			env: { type: "string", multiple: true },
			"env-file": { type: "string", multiple: true },
			enable: { type: "boolean" },
			disable: { type: "boolean" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp configure <name> [flags]

Arguments:
  name            MCP name (required)

Flags:
  --command <cmd>   Override the command
  --args <arg>      Make this the new args list (repeatable)
  --env <KEY=VAL>   Additional environment variables (repeatable)
  --enable          Enable the MCP
  --disable         Disable the MCP
  -h, --help        Show help
`);
		return 0;
	}

	const name = positionals[0];
	if (!name) {
		console.error("Error: MCP name required");
		return 2;
	}

	if (values.enable && values.disable) {
		console.error("Error: Cannot pass both --enable and --disable");
		return 2;
	}

	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const server = await registry.get(name);
		if (!server) {
			console.error(`Error: MCP "${name}" not found`);
			return 1;
		}

		const globalEnvLookup =
			process.env.NOOA_MCP_GLOBAL_ENV_FILE ||
			join(process.env.HOME ?? "", ".nooa", "mcp.env");
		const repoRoot = (await findProjectRoot(process.cwd())) ?? process.cwd();
		const defaultEnvFiles: string[] = [];

		if (globalEnvLookup) {
			const expanded = expandHomePath(globalEnvLookup);
			if (await fileExists(expanded)) {
				defaultEnvFiles.push(expanded);
			}
		}

		const rootEnvFile = resolve(repoRoot, ".mcp.env");
		if (await fileExists(rootEnvFile)) {
			defaultEnvFiles.push(rootEnvFile);
		}

		const rawEnvFiles = values["env-file"];
		const explicitEnvFiles =
			typeof rawEnvFiles === "string"
				? [rawEnvFiles]
				: Array.isArray(rawEnvFiles)
					? rawEnvFiles
					: [];
		const resolvedExplicitEnvFiles = explicitEnvFiles.map((value) =>
			resolveEnvPath(value, repoRoot),
		);

		const envFiles = [...defaultEnvFiles, ...resolvedExplicitEnvFiles];
		const fileEnv: Record<string, string> = {};
		for (const envPath of envFiles) {
			if (!(await fileExists(envPath))) {
				continue;
			}
			const parsed = await loadEnvFile(envPath);
			Object.assign(fileEnv, parsed);
		}

		const updated = {
			...server,
			command: (values.command as string | undefined) ?? server.command,
			args: (values.args as string[] | undefined)?.length
				? values.args
				: server.args,
			env: {
				...(server.env ?? {}),
				...fileEnv,
				...parseEnvEntries(values.env as string[] | undefined),
			},
			enabled: values.enable ?? (!values.disable ? server.enabled : false),
		};

		await registry.add(updated);
		console.log(`✅ Updated MCP "${name}"`);
		return 0;
	} finally {
		db.close();
	}
}
