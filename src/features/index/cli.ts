import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { resolve, relative } from "node:path";
import { indexRepo, indexFile, clearIndex, getIndexStats, rebuildIndex } from "./execute";
import { logger } from "../../core/logger";

const indexHelp = `
Usage: nooa index [subcommand] [flags]

Semantic indexing for code and memory.

Subcommands:
  repo     Index all TypeScript and Markdown files in the repository.
  file     Index a specific file.
  clear    Clear the index.
  stats    Show index statistics.
  rebuild  Clear and rebuild the index.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa index repo
  nooa index file src/index.ts
  nooa index stats --json
`;

const indexCommand: Command = {
	name: "index",
	description: "Semantic indexing operations",
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
			console.log(indexHelp);
			return;
		}

		const sub = positionals[1];

		if (sub === "repo") {
			try {
				console.log("🔍 Indexing repository (TypeScript/Markdown)...");
				const result = await indexRepo();
				if (values.json) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(`✅ Indexing complete!`);
					console.log(`   Files: ${result.files}`);
					console.log(`   Chunks: ${result.totalChunks}`);
					console.log(`   Trace ID: ${result.traceId}`);
				}
			} catch (e) {
				logger.error("index.error", e as Error);
				process.exitCode = 1;
			}
		} else if (sub === "file") {
			const file = positionals[2];
			if (!file) {
				console.error("❌ File path required");
				process.exitCode = 1;
				return;
			}
			try {
				const fullPath = resolve(process.cwd(), file);
				const relPath = relative(process.cwd(), fullPath);
				const result = await indexFile(fullPath, relPath);

				if (values.json) {
					console.log(JSON.stringify(result, null, 2));
				} else {
					console.log(`✅ Indexed ${relPath} (${result.chunks} chunks)`);
				}
			} catch (e) {
				logger.error("index.file.error", e as Error);
				process.exitCode = 1;
			}
		} else if (sub === "clear") {
			await clearIndex();
			console.log(values.json ? JSON.stringify({ status: "cleared" }) : "✅ Index cleared.");
		} else if (sub === "stats") {
			const stats = await getIndexStats();
			if (values.json) {
				console.log(JSON.stringify(stats, null, 2));
			} else {
				console.log(`📊 Index Stats:`);
				console.log(`   Documents: ${stats.documents}`);
				console.log(`   Chunks:    ${stats.chunks}`);
			}
		} else if (sub === "rebuild") {
			console.log("🔄 Rebuilding index...");
			const result = await rebuildIndex();
			if (values.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				console.log(`✅ Rebuild complete! (${result.totalChunks} chunks)`);
			}
		} else {
			console.log(indexHelp);
		}
	},
};

export default indexCommand;
