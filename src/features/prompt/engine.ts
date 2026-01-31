import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { logger } from "../../core/logger";

export interface PromptMetadata {
	name: string;
	version: string;
	description: string;
	output?: "json" | "markdown";
	temperature?: number;
	[key: string]: any;
}

export interface Prompt {
	metadata: PromptMetadata;
	body: string;
}

export class PromptEngine {
	constructor(private templatesDir: string) {}

	async listPrompts(): Promise<PromptMetadata[]> {
		const files = await readdir(this.templatesDir);
		const prompts: PromptMetadata[] = [];
		for (const file of files) {
			if (file.endsWith(".md")) {
				try {
					const prompt = await this.loadPrompt(file.replace(".md", ""));
					prompts.push(prompt.metadata);
				} catch (e) {
					// Skip invalid prompts during listing
					logger.error(`Error loading prompt ${file}`, e instanceof Error ? e : new Error(String(e)));
				}
			}
		}
		return prompts;
	}

	async loadPrompt(name: string): Promise<Prompt> {
		const path = join(this.templatesDir, `${name}.md`);
		const content = await readFile(path, "utf-8");
		return this.parsePrompt(content);
	}

	parsePrompt(content: string): Prompt {
		const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (!match?.[1]) {
			throw new Error("Invalid prompt format: Missing YAML frontmatter.");
		}

		const frontmatter = match[1];
		const body = content.replace(match[0], "").trim();
		const metadata = yaml.load(frontmatter) as PromptMetadata;

		if (!metadata.name || !metadata.version || !metadata.description) {
			throw new Error("Invalid prompt metadata: Missing name, version, or description.");
		}

		return { metadata, body };
	}

	renderPrompt(prompt: Prompt, vars: Record<string, any>): string {
		let rendered = prompt.body;
		for (const [key, value] of Object.entries(vars)) {
			const regex = new RegExp(`{{${key}}}`, "g");
			rendered = rendered.replace(regex, String(value));
		}
		return rendered;
	}

    async bumpVersion(name: string, level: "patch" | "minor" | "major"): Promise<string> {
        const path = join(this.templatesDir, `${name}.md`);
        const content = await readFile(path, "utf-8");
        const prompt = this.parsePrompt(content);
        
        const parts = prompt.metadata.version.split(".").map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
            throw new Error(`Invalid version format: ${prompt.metadata.version}`);
        }
        const [major, minor, patch] = parts as [number, number, number];
        let nextVersion = "";
        
        switch (level) {
            case "major": nextVersion = `${major + 1}.0.0`; break;
            case "minor": nextVersion = `${major}.${minor + 1}.0`; break;
            case "patch": nextVersion = `${major}.${minor}.${patch + 1}`; break;
        }

        const newMetadata = { ...prompt.metadata, version: nextVersion };
        const newFrontmatter = yaml.dump(newMetadata).trim();
        const newContent = `---\n${newFrontmatter}\n---\n\n${prompt.body}`;
        
        await writeFile(path, newContent);
        return nextVersion;
    }
}
