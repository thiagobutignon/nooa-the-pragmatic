import type { Command, CommandContext } from "../../core/command";

const embedHelp = `
Usage: nooa embed <text|file> <input> [flags]

Arguments:
  text <string>     Embed a raw string
  file <path>       Embed file contents

Flags:
  --model <name>            Model name (default: nomic-embed-text)
  --provider <name>         Provider (default: ollama)
  --include-embedding       Include vector in output
  --out <file>              Write JSON output to file
  --json                    Output JSON (default)
  -h, --help                Show help
`;

const embedCommand: Command = {
	name: "embed",
	description: "Generate embeddings for text or files",
	execute: async ({ rawArgs }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values } = parseArgs({
			args: rawArgs,
			options: {
				model: { type: "string" },
				provider: { type: "string" },
				"include-embedding": { type: "boolean" },
				out: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean", short: "h" },
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		if (values.help) {
			console.log(embedHelp);
			return;
		}

		console.log(embedHelp);
	},
};

export default embedCommand;
