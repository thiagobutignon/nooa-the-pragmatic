export type AgentManifest = {
	generated: string;
	version: string;
	features: AgentManifestFeature[];
};

export type AgentManifestFeature = {
	name: string;
	description?: string;
	agentDoc?: string;
};

export type SystemPromptOptions = {
	maxTools?: number;
};

const DEFAULT_MAX_TOOLS = 40;

function extractCliUsage(agentDoc?: string) {
	if (!agentDoc) return undefined;
	const match = agentDoc.match(/<cli>([\s\S]*?)<\/cli>/i);
	if (!match) return undefined;
	return decodeXml(match[1].trim());
}

function decodeXml(value: string) {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

export async function buildSystemPrompt(
	manifest: AgentManifest,
	options: SystemPromptOptions = {},
) {
	const { PromptEngine } = await import("../../features/prompt/engine");
	const { resolve } = await import("node:path");

	const maxTools = options.maxTools ?? DEFAULT_MAX_TOOLS;
	const toolLines = manifest.features.slice(0, maxTools).map((feature) => {
		const usage = extractCliUsage(feature.agentDoc);
		const description = feature.description?.trim() || "";
		const usageText = usage ? ` CLI: ${usage}` : "";
		return `- ${feature.name}: ${description}${usageText}`.trim();
	});

	// Load template using PromptEngine
	const repoRoot = resolve(import.meta.dir, "../../..");
	const templatesDir = resolve(repoRoot, "src/features/prompt/templates");

	const engine = new PromptEngine(templatesDir);
	const prompt = await engine.loadPrompt("tui-agent");

	return engine.renderPrompt(prompt, {
		tools: toolLines.join("\n"),
	});
}
