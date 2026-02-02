import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { applyPatch } from "../code/patch";
import { PromptEngine } from "./engine";

export type CreatePromptArgs = {
	templatesDir: string;
	name: string;
	description: string;
	output?: "json" | "markdown";
	body: string;
};

export type EditPromptArgs = {
	templatesDir: string;
	name: string;
	patch: string;
};

export type DeletePromptArgs = {
	templatesDir: string;
	name: string;
};

export type PublishPromptArgs = {
	templatesDir: string;
	name: string;
	level: "patch" | "minor" | "major";
	changelogPath: string;
	note: string;
};

function promptPath(templatesDir: string, name: string) {
	return join(templatesDir, `${name}.md`);
}

async function ensureMissing(path: string) {
	try {
		await access(path);
		throw new Error(`Prompt already exists: ${path}`);
	} catch (error: any) {
		if (error?.code !== "ENOENT") throw error;
	}
}

export async function createPrompt(args: CreatePromptArgs) {
	await mkdir(args.templatesDir, { recursive: true });
	const path = promptPath(args.templatesDir, args.name);
	await ensureMissing(path);

	const metadata: Record<string, any> = {
		name: args.name,
		version: "1.0.0",
		description: args.description,
	};
	if (args.output) metadata.output = args.output;

	const frontmatter = yaml.dump(metadata).trim();
	const content = `---\n${frontmatter}\n---\n\n${args.body}`;
	await writeFile(path, content);
}

export async function editPrompt(args: EditPromptArgs) {
	const path = promptPath(args.templatesDir, args.name);
	const original = await readFile(path, "utf8");
	const updated = applyPatch(original, args.patch);
	await writeFile(path, updated);
}

export async function deletePrompt(args: DeletePromptArgs) {
	const path = promptPath(args.templatesDir, args.name);
	try {
		await rm(path);
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			throw new Error(`Prompt not found: ${args.name}`);
		}
		throw error;
	}
}

export async function publishPrompt(args: PublishPromptArgs) {
	const engine = new PromptEngine(args.templatesDir);
	const nextVersion = await engine.bumpVersion(args.name, args.level);
	await updateChangelog({
		changelogPath: args.changelogPath,
		name: args.name,
		version: nextVersion,
		note: args.note,
	});
	return nextVersion;
}

async function updateChangelog(args: {
	changelogPath: string;
	name: string;
	version: string;
	note: string;
}) {
	let existing = "";
	try {
		existing = await readFile(args.changelogPath, "utf8");
	} catch (error: any) {
		if (error?.code !== "ENOENT") throw error;
	}

	const date = new Date().toISOString().slice(0, 10);
	const entry = `### v${args.version} - ${date}\n- ${args.note}\n`;

	if (!existing) {
		const content = `# Prompt Changelog\n\n## ${args.name}\n${entry}\n`;
		await writeFile(args.changelogPath, content);
		return;
	}

	const sectionHeader = `## ${args.name}`;
	if (!existing.includes(sectionHeader)) {
		const content = `${existing.trimEnd()}\n\n${sectionHeader}\n${entry}\n`;
		await writeFile(args.changelogPath, content);
		return;
	}

	const parts = existing.split(sectionHeader);
	const before = parts.shift() ?? "";
	const after = parts.join(sectionHeader);
	const updated = `${before}${sectionHeader}\n${entry}\n${after.replace(/^\n?/, "")}`;
	await writeFile(args.changelogPath, updated);
}
