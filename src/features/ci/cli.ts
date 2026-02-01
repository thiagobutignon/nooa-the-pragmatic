import { parseArgs } from "node:util";
import { logger } from "../../core/logger";
import { executeCi } from "./execute";

export async function ciCli(args: string[], bus?: any) {
	const { values } = parseArgs({
		args,
		options: {
			json: { type: "boolean" },
			out: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	const ciHelp = `
Usage: nooa ci [flags]

Run local CI pipeline (test + lint + policy check).

Flags:
  --json         Output results as JSON.
  --out <file>   Write results to a file.
  -h, --help     Show help message.

Examples:
  nooa ci
  nooa ci --json
  nooa ci --json --out .nooa/reports/ci.json
`;

	if (values.help) {
		console.log(ciHelp);
		return;
	}

	try {
		console.log("🔍 Running CI pipeline...\n");
		const result = await executeCi({ json: values.json }, bus);

		if (values.json) {
			const output = {
				schemaVersion: "1.0",
				ok: result.ok,
				traceId: result.traceId,
				command: "ci",
				timestamp: new Date().toISOString(),
				stages: {
					test: result.test,
					lint: result.lint,
					check: result.check,
				},
				duration_ms: result.duration_ms,
			};
			const jsonOutput = JSON.stringify(output, null, 2);
			if (values.out) {
				const { writeFile } = await import("node:fs/promises");
				await writeFile(values.out, jsonOutput);
				console.log(`✅ Results written to ${values.out}`);
			} else {
				console.log(jsonOutput);
			}
		} else {
			// Human-readable output
			console.log(
				result.test.passed
					? "✅ Tests passed"
					: `❌ Tests failed (exit: ${result.test.exitCode})`,
			);
			console.log(
				result.lint.passed
					? "✅ Lint passed"
					: `❌ Lint failed (exit: ${result.lint.exitCode})`,
			);
			console.log(
				result.check.passed
					? "✅ Policy check passed"
					: `❌ Policy violations: ${result.check.violations}`,
			);
			console.log(`\n⏱️  Duration: ${result.duration_ms}ms`);
			console.log(
				result.ok
					? `\n✅ CI passed [${result.traceId}]`
					: `\n❌ CI failed [${result.traceId}]`,
			);
		}

		process.exitCode = result.ok ? 0 : 1;
	} catch (e) {
		logger.error("ci.error", e as Error);
		process.exitCode = 1;
	}
}

const ciCommand = {
	name: "ci",
	description: "Run local CI pipeline (test + lint + check)",
	async execute({ rawArgs, bus }: any) {
		const index = rawArgs.indexOf("ci");
		await ciCli(rawArgs.slice(index + 1), bus);
	},
};

export default ciCommand;
