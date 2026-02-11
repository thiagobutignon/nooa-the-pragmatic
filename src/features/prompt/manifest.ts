import type { Command } from "../../core/command";
import type { Skill } from "../skills/manager";

export type ToolManifestEntry = {
	name: string;
	description: string;
	modes: string[];
	embedding: number[];
};

export type SkillManifestEntry = {
	name: string;
	description: string;
	embedding: number[];
};

export type InjectionPatternEntry = {
	text: string;
	embedding: number[];
};

export type Embedder = (input: string) => Promise<number[]>;

const IMPERATIVE_PATTERNS = [
	/\byou must\b/gi,
	/\byou should\b/gi,
	/\bignore previous instructions\b/gi,
	/\bdisregard (all )?previous\b/gi,
	/\bforget your rules\b/gi,
	/\boverride\b/gi,
];

const TOOL_HINTS: Record<string, string[]> = {
	ci: ["tests", "unit tests", "testes unitarios", "test unitaire", "pruebas unitarias"],
};

export function normalizeDescription(input: string) {
	let output = input;
	for (const pattern of IMPERATIVE_PATTERNS) {
		output = output.replace(pattern, "");
	}
	return output.replace(/\s+/g, " ").trim();
}

function decodeXml(value: string) {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function extractCliUsage(agentDoc?: string) {
	if (!agentDoc) return undefined;
	const match = agentDoc.match(/<cli>([\s\S]*?)<\/cli>/i);
	if (!match) return undefined;
	return decodeXml(match[1].trim());
}

export async function buildToolManifest(
	commands: Command[],
	embed: Embedder,
): Promise<ToolManifestEntry[]> {
	const entries: ToolManifestEntry[] = [];
	for (const command of commands) {
		const description = normalizeDescription(command.description ?? "");
		const cli = extractCliUsage(command.agentDoc);
		const hints = TOOL_HINTS[command.name]?.join(", ");
		const combined = [command.name, description, cli, hints]
			.filter(Boolean)
			.join(" - ")
			.trim();
		const embedding = await embed(combined);
		entries.push({
			name: command.name,
			description: description || command.name,
			modes: ["any"],
			embedding,
		});
	}
	return entries;
}

export async function buildSkillManifest(
	skills: Skill[],
	embed: Embedder,
): Promise<SkillManifestEntry[]> {
	const entries: SkillManifestEntry[] = [];
	for (const skill of skills) {
		if (!skill.enabled) continue;
		const description = normalizeDescription(skill.description ?? "");
		const combined = [skill.name, description].filter(Boolean).join(" - ");
		const embedding = await embed(combined);
		entries.push({
			name: skill.name,
			description: description || skill.name,
			embedding,
		});
	}
	return entries;
}

export async function buildInjectionManifest(
	patterns: string[],
	embed: Embedder,
): Promise<InjectionPatternEntry[]> {
	const entries: InjectionPatternEntry[] = [];
	for (const pattern of patterns) {
		const embedding = await embed(pattern);
		entries.push({ text: pattern, embedding });
	}
	return entries;
}
