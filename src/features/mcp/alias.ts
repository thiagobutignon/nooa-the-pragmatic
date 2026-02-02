import { parseArgs } from "node:util";
import { Registry } from "../../core/mcp/Registry";
import { parseEnvEntries } from "./helpers";

export async function aliasCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			json: { type: "boolean" },
			command: { type: "string" },
			description: { type: "string" },
			args: { type: "string", multiple: true },
			env: { type: "string", multiple: true },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help || positionals.length === 0) {
		console.log(`Usage: nooa mcp alias <subcommand> [args]

Subcommands:
  create <name> --command <cmd> [--args <arg>] [--env KEY=VAL] [--description <text>]
  list [--json]
  delete <name>

Global Flags:
  --json   Output results as JSON.
  -h, --help Show help message.
`);
		return 0;
	}

	const subcommand = positionals[0];
	const name = positionals[1];
	const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
	const { Database } = await import("bun:sqlite");
	const db = new Database(dbPath);
	const registry = new Registry(db);

	try {
		switch (subcommand) {
			case "create": {
				if (!name) {
					console.error("Error: Alias name required");
					return 2;
				}
				if (!values.command) {
					console.error("Error: --command is required when creating an alias");
					return 2;
				}
				await registry.aliasCreate(name, values.command, values.args ?? [], {
					env: parseEnvEntries(values.env as string[] | undefined),
					description: values.description,
				});
				console.log(`✅ Alias "${name}" saved`);
				return 0;
			}

			case "list": {
				const aliases = await registry.aliasList();
				if (values.json) {
					console.log(JSON.stringify(aliases, null, 2));
				} else if (aliases.length === 0) {
					console.log("(no aliases configured)");
				} else {
					for (const alias of aliases) {
						console.log(
							`- ${alias.name}: ${alias.command} ${alias.args?.join(" ") ?? ""}`,
						);
					}
				}
				return 0;
			}

			case "delete": {
				if (!name) {
					console.error("Error: Alias name required for delete");
					return 2;
				}
				await registry.aliasDelete(name);
				console.log(`✅ Alias "${name}" removed`);
				return 0;
			}

			default:
				console.error(`Unknown alias subcommand: ${subcommand}`);
				return 1;
		}
	} finally {
		db.close();
	}
}
