import type { Command, CommandContext } from "../../core/command";
import { embedText } from "./engine";

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
		const { readFile, writeFile } = await import("node:fs/promises");
		const { randomUUID } = await import("node:crypto");
		const { values, positionals } = parseArgs({
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

		const action = positionals[1];
		const inputArg = positionals.slice(2).join(" ").trim();
		if (!action || !inputArg) {
			console.error("Error: Input is required.");
			process.exitCode = 2;
			return;
		}

		let inputText = "";
		let inputType: "text" | "file" = "text";
		let inputPath: string | null = null;

		if (action === "text") {
			inputType = "text";
			inputText = inputArg;
		} else if (action === "file") {
			inputType = "file";
			inputPath = positionals[2];
			if (!inputPath) {
				console.error("Error: File path is required.");
				process.exitCode = 2;
				return;
			}
			inputText = await readFile(inputPath, "utf-8");
		} else {
			console.error("Error: Unknown embed action.");
			process.exitCode = 2;
			return;
		}

		const result = await embedText(inputText, {
			provider: values.provider as string | undefined,
			model: values.model as string | undefined,
		});

		const payload: Record<string, unknown> = {
			id: randomUUID(),
			model: result.model,
			provider: result.provider,
			dimensions: result.dimensions,
			input: {
				type: inputType,
				path: inputPath,
				value: inputType === "text" ? inputText : null,
			},
		};

		if (values["include-embedding"]) {
			payload.embedding = result.embedding;
		}

		const output = JSON.stringify(payload, null, 2);
		if (values.out) {
			await writeFile(String(values.out), output);
			return;
		}

		console.log(output);
	},
};

export default embedCommand;
