import type { Command, CommandContext } from "../../core/command";
import { executeReview } from "./execute";
import { logger } from "../../core/logger";

const reviewHelp = `
Usage: nooa review [path] [flags]

Perform an AI-powered code review of a file or staged changes.

Arguments:
  [path]              Path to a file to review. If omitted, staged changes are reviewed.

Flags:
  --prompt <name>     Use a specific prompt template (default: review).
  --json              Output as structured JSON.
  --out <file>        Save output to a file (especially useful with --json).
  --fail-on <level>   Exit with code 1 if findings with severity >= level are found.
                      (Levels: low, medium, high)
  -h, --help          Show help message.

Examples:
  nooa review src/index.ts
  nooa review --json --out review-results.json
  nooa review --fail-on high
`;

const reviewCommand: Command = {
	name: "review",
	description: "Perform a code review",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				prompt: { type: "string" },
				json: { type: "boolean" },
				out: { type: "string" },
				"fail-on": { type: "string" },
				help: { type: "boolean", short: "h" },
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		if (values.help) {
			console.log(reviewHelp);
			return;
		}

		const path = positionals[1];
		const { writeFile } = await import("node:fs/promises");

		try {
			const { content, result, traceId } = await executeReview({
				path,
				staged: !path,
				json: !!values.json,
				prompt: values.prompt,
				failOn: values["fail-on"],
			}, bus);

			const outputJson = values.json ? JSON.stringify({
				schemaVersion: "1.0",
				ok: !!result,
				traceId,
				command: "review",
                timestamp: new Date().toISOString(),
				...result
			}, null, 2) : content;

			if (values.out) {
				await writeFile(values.out, outputJson, "utf-8");
			} else {
				console.log(outputJson);
			}

            if (values.json && !result) {
                // Parsing failed or AI error
                process.exitCode = 1;
                return;
            }

			// Gate check for fail-on
			if (values["fail-on"] && result) {
				const levels = ["low", "medium", "high"];
				const minLevelIdx = levels.indexOf(values["fail-on"]);
				if (minLevelIdx !== -1) {
					const highSeverityIssues = result.findings.filter(f => 
						levels.indexOf(f.severity) >= minLevelIdx
					);
					if (highSeverityIssues.length > 0) {
						if (!values.json && !values.out) {
							console.error(`\nFound ${highSeverityIssues.length} issues with severity >= ${values["fail-on"]}.`);
						}
						process.exitCode = 1;
					}
				} else {
                    console.error(`Error: Invalid severity level '${values["fail-on"]}'.`);
                    process.exitCode = 2;
                    return;
                }
			}

		} catch (error: any) {
			const message = error.message;
            const isValidationError = message.includes("No input source") || message.includes("not found");
			if (values.json) {
				console.log(JSON.stringify({ 
                    schemaVersion: "1.0",
                    ok: false, 
                    command: "review",
                    error: message 
                }, null, 2));
			} else {
				console.error(`Error: ${message}`);
			}
			process.exitCode = isValidationError ? 2 : 1;
		} finally {
			logger.clearContext();
		}
	},
};

export default reviewCommand;
