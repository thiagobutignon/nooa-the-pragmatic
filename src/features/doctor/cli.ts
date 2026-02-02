import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import type { EventBus } from "../../core/event-bus";
import { logger } from "../../core/logger";
import { executeDoctorCheck } from "./execute";

export async function doctorCli(args: string[], bus?: EventBus) {
	const { values } = parseArgs({
		args,
		options: {
			json: { type: "boolean" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	const doctorHelp = `
Usage: nooa doctor [flags]

Check development environment health.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa doctor
  nooa doctor --json

Exit Codes:
  0: All tools available
  1: One or more tools missing
`;

	if (values.help) {
		console.log(doctorHelp);
		return;
	}

	try {
		if (!values.json) {
			console.log("🔍 Checking environment...\n");
		}
		const result = await executeDoctorCheck(bus);

		if (values.json) {
			const output = {
				schemaVersion: "1.0",
				ok: result.ok,
				traceId: result.traceId,
				command: "doctor",
				timestamp: new Date().toISOString(),
				tools: {
					bun: result.bun,
					git: result.git,
					rg: result.rg,
					sqlite: result.sqlite,
				},
				duration_ms: result.duration_ms,
			};
			console.log(JSON.stringify(output, null, 2));
		} else {
			// Human-readable output
			console.log(
				result.bun.available
					? `✅ bun: ${result.bun.version}`
					: "❌ bun: not found",
			);
			console.log(
				result.git.available
					? `✅ git: ${result.git.version}`
					: "❌ git: not found",
			);
			console.log(
				result.rg.available
					? `✅ ripgrep: ${result.rg.version}`
					: "❌ ripgrep: not found (install via: brew install ripgrep)",
			);
			console.log(
				result.sqlite.available
					? `✅ sqlite3: ${result.sqlite.version}`
					: "❌ sqlite3: not found",
			);
			console.log(`\n⏱️  Duration: ${result.duration_ms}ms`);
			console.log(
				result.ok
					? `\n✅ Environment healthy [${result.traceId}]`
					: `\n❌ Issues found [${result.traceId}]`,
			);
		}

		process.exitCode = result.ok ? 0 : 1;
	} catch (error) {
		logger.error(
			"doctor.error",
			error instanceof Error ? error : new Error(String(error)),
		);
		process.exitCode = 1;
	}
}

const doctorCommand: Command = {
	name: "doctor",
	description: "Check environment health",
	async execute({ rawArgs, bus }: CommandContext) {
		const index = rawArgs.indexOf("doctor");
		await doctorCli(rawArgs.slice(index + 1), bus);
	},
};

export default doctorCommand;
