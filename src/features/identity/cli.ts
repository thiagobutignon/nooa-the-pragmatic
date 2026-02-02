import { parseArgs } from "node:util";
import { initIdentity } from "./init";

export async function initCli(args: string[]) {
	const { values } = parseArgs({
		args,
		options: {
			help: { type: "boolean", short: "h" },
			force: { type: "boolean" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`
Usage: nooa init [flags]

Initialize NOOA identity artifacts (Identity, Soul, User) in .nooa/ directory.

Flags:
  -h, --help    Show help message
  --force       Overwrite existing files (not implemented yet, safe default)
`);
		return;
	}

	try {
		await initIdentity(process.cwd());
		console.log("\n✅ NOOA Identity initialized in .nooa/");
		console.log("- IDENTITY.md: Who I am");
		console.log("- SOUL.md: My directives");
		console.log("- USER.md: Who you are");
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : JSON.stringify(error);
		console.error(`❌ Init failed: ${message}`);
		process.exitCode = 1;
	}
}

const initCommand = {
	name: "init",
	description: "Initialize agent identity artifacts",
	async execute({ rawArgs }: { rawArgs: string[] }) {
		// init is top-level, so just pass args
		const index = rawArgs.indexOf("init");
		await initCli(rawArgs.slice(index + 1));
	},
};

export default initCommand;
