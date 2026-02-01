import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { addPattern, removePattern, loadIgnore } from "./execute";

const ignoreHelp = `
Usage: nooa ignore <command> [pattern] [flags]

Manage .nooa-ignore patterns for policy audits.

Commands:
  add <pattern>    Add a new pattern to the ignore list.
  remove <pattern> Remove a pattern from the ignore list.
  list             Display all current ignore patterns.

Flags:
  --json           Output results as JSON.
  -h, --help       Show help message.

Examples:
  nooa ignore add secret.ts
  nooa ignore remove temp/
  nooa ignore list
`;

const ignoreCommand: Command = {
    name: "ignore",
    description: "Manage .nooa-ignore patterns",
    execute: async ({ rawArgs }: CommandContext) => {
        const { values, positionals } = parseArgs({
            args: rawArgs,
            options: {
                help: { type: "boolean", short: "h" },
                json: { type: "boolean" }
            },
            allowPositionals: true,
            strict: false
        });

        if (values.help) {
            console.log(ignoreHelp);
            return;
        }

        // positionals[0] is 'ignore', so subcommands are at [1]
        const cmdIndex = positionals.indexOf("ignore");
        const subcommand = positionals[cmdIndex + 1];
        const pattern = positionals[cmdIndex + 2];

        if (subcommand === "add") {
            if (!pattern) {
                console.error("Error: Pattern is required for 'add'.");
                process.exitCode = 2;
                return;
            }
            const added = await addPattern(pattern);
            if (values.json) {
                console.log(JSON.stringify({ ok: true, action: "add", pattern, changed: added }));
            } else {
                console.log(added ? `✅ Pattern '${pattern}' added.` : `ℹ️ Pattern '${pattern}' already exists.`);
            }
        } else if (subcommand === "remove") {
            if (!pattern) {
                console.error("Error: Pattern is required for 'remove'.");
                process.exitCode = 2;
                return;
            }
            const removed = await removePattern(pattern);
            if (values.json) {
                console.log(JSON.stringify({ ok: true, action: "remove", pattern, changed: removed }));
            } else {
                console.log(removed ? `✅ Pattern '${pattern}' removed.` : `ℹ️ Pattern '${pattern}' not found.`);
            }
        } else if (subcommand === "list") {
            const patterns = await loadIgnore();
            if (values.json) {
                console.log(JSON.stringify({ ok: true, action: "list", patterns }));
            } else {
                if (patterns.length === 0) {
                    console.log("ℹ️ No patterns found in .nooa-ignore.");
                } else {
                    console.log("Current ignore patterns:");
                    for (const p of patterns) console.log(`  - ${p}`);
                }
            }
        } else {
            console.error(`Error: Unknown subcommand '${subcommand}'.`);
            console.log(ignoreHelp);
            process.exitCode = 2;
        }
    }
};

export default ignoreCommand;
