import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import {
	addPattern,
	checkPathIgnored,
	loadIgnore,
	matchesPattern,
	removePattern,
} from "./execute";

const ignoreHelp = `
Usage: nooa ignore <command> [pattern] [paths...] [flags]

Manage .nooa-ignore patterns for policy audits.

Commands:
  add <pattern>        Add a new pattern to the ignore list.
  remove <pattern>     Remove a pattern from the ignore list.
  list                 Display all current ignore patterns.
  check <path>         Check whether <path> is ignored by the current list.
  test <pattern> [path...]
                       Test a pattern locally against sample paths.

Flags:
  --json               Output results as JSON.
  -h, --help           Show help message.

Examples:
  nooa ignore add secret.ts
  nooa ignore list
  nooa ignore check logs/app.log
  nooa ignore test "logs/*.log" logs/app.log README.md
`;

const ignoreCommand: Command = {
	name: "ignore",
	description: "Manage .nooa-ignore patterns",
	execute: async ({ rawArgs }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
			},
			allowPositionals: true,
			strict: false,
		});

		if (values.help) {
			console.log(ignoreHelp);
			return;
		}

		// positionals[0] is 'ignore', so subcommands are at [1]
		const cmdIndex = positionals.indexOf("ignore");
		const subcommand = positionals[cmdIndex + 1];
		const args = positionals.slice(cmdIndex + 2);

		if (subcommand === "add") {
			const [pattern] = args;
			if (!pattern) {
				console.error("Error: Pattern is required for 'add'.");
				process.exitCode = 2;
				return;
			}
			const added = await addPattern(pattern);
			if (values.json) {
				console.log(
					JSON.stringify({ ok: true, action: "add", pattern, changed: added }),
				);
			} else {
				console.log(
					added
						? `✅ Pattern '${pattern}' added.`
						: `ℹ️ Pattern '${pattern}' already exists.`,
				);
			}
		} else if (subcommand === "remove") {
			const [pattern] = args;
			if (!pattern) {
				console.error("Error: Pattern is required for 'remove'.");
				process.exitCode = 2;
				return;
			}
			const removed = await removePattern(pattern);
			if (values.json) {
				console.log(
					JSON.stringify({
						ok: true,
						action: "remove",
						pattern,
						changed: removed,
					}),
				);
			} else {
				console.log(
					removed
						? `✅ Pattern '${pattern}' removed.`
						: `ℹ️ Pattern '${pattern}' not found.`,
				);
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
		} else if (subcommand === "check") {
			const [target] = args;
			if (!target) {
				console.error("Error: Path is required for 'check'.");
				process.exitCode = 2;
				return;
			}
			const result = await checkPathIgnored(target);
			if (values.json) {
				console.log(
					JSON.stringify({
						ok: result.ignored,
						action: "check",
						path: target,
						ignored: result.ignored,
						pattern: result.pattern ?? null,
					}),
				);
			} else if (result.ignored) {
				console.log(`✅ ${target} is ignored by ${result.pattern}`);
			} else {
				console.log(`❌ ${target} is not ignored by any pattern.`);
			}
			process.exitCode = result.ignored ? 0 : 1;
			return;
		} else if (subcommand === "test") {
			const [pattern, ...samples] = args;
			if (!pattern) {
				console.error("Error: Pattern is required for 'test'.");
				process.exitCode = 2;
				return;
			}
			const samplePaths = samples.length ? samples : ["."];
			const results = samplePaths.map((sample) => ({
				path: sample,
				matches: matchesPattern(pattern, sample),
			}));
			const matched = results.some((item) => item.matches);
			if (values.json) {
				console.log(
					JSON.stringify({
						ok: matched,
						action: "test",
						pattern,
						results,
					}),
				);
			} else {
				console.log(`Testing pattern: ${pattern}`);
				for (const result of results) {
					console.log(`${result.matches ? "✅" : "❌"} ${result.path}`);
				}
				if (!matched) {
					console.log(`No matches for pattern '${pattern}'.`);
				}
			}
			process.exitCode = matched ? 0 : 2;
			return;
		} else {
			console.error(`Error: Unknown subcommand '${subcommand}'.`);
			console.log(ignoreHelp);
			process.exitCode = 2;
		}
	},
};

export default ignoreCommand;
