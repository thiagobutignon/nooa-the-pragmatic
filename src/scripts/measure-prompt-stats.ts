import { join } from "node:path";
import { PromptAssembler } from "../features/prompt/assembler";
import { PromptEngine } from "../features/prompt/engine";

export interface PromptStatsResult {
	task: string;
	staticTokens: number;
	dynamicTokens: number;
	latencyMs: number;
}

export async function measurePromptStats(options: {
	root: string;
	task: string;
}): Promise<PromptStatsResult> {
	const { root, task } = options;
	const templatesDir = join(root, "src/features/prompt/templates");
	const promptEngine = new PromptEngine(templatesDir);
	const tuiTemplate = await promptEngine.loadPrompt("tui-agent");
	const staticTokens = estimateTokens(tuiTemplate.body ?? "");

	const assembler = new PromptAssembler();
	const start = Date.now();
	const assembled = await assembler.assemble({
		task,
		mode: "auto",
		root,
	});
	const latencyMs = Date.now() - start;
	const dynamicTokens = estimateTokens(String(assembled));

	return { task, staticTokens, dynamicTokens, latencyMs };
}

function estimateTokens(text: string) {
	return Math.ceil(text.length / 4);
}

if (import.meta.main) {
	const task = process.argv.slice(2).join(" ") || "default task";
	measurePromptStats({ root: process.cwd(), task })
		.then((result) => {
			console.log(JSON.stringify(result, null, 2));
		})
		.catch((err) => {
			console.error("Failed to measure prompt stats:", err);
			process.exit(1);
		});
}
