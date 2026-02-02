import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { applyPatch } from "../code/patch";

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
