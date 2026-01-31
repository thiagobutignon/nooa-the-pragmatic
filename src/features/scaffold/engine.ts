import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";

export interface RenderContext {
    name: string;
    Command: string;
    repo_root: string;
    year: string;
}

export class ScaffoldEngine {
    constructor(private templatesDir: string) {}

    validateName(name: string) {
        const kebabRegex = /^[a-z][a-z0-9-]*$/;
        if (!kebabRegex.test(name)) {
            throw new Error(`Invalid name: "${name}". Must be kebab-case (e.g., "my-feature").`);
        }

        const reserved = ["core", "features", "prompt", "scaffold", "eval", "registry", "ai", "index"];
        if (reserved.includes(name)) {
            throw new Error(`Invalid name: "${name}" is a reserved word.`);
        }
    }

    async renderTemplate(templateName: string, context: RenderContext): Promise<string> {
        const tplPath = join(this.templatesDir, `${templateName}.tpl`);
        let content = await readFile(tplPath, "utf-8");

        // Simple placeholder replacement
        content = content.replace(/{{name}}/g, context.name);
        content = content.replace(/{{camelName}}/g, (context as any).camelName || context.name);
        content = content.replace(/{{Command}}/g, context.Command);
        content = content.replace(/{{repo_root}}/g, context.repo_root);
        content = content.replace(/{{year}}/g, context.year);

        return content;
    }

    async ensureDir(path: string) {
        await mkdir(dirname(path), { recursive: true });
    }

    async fileExists(path: string): Promise<boolean> {
        try {
            await access(path);
            return true;
        } catch {
            return false;
        }
    }

    async write(path: string, content: string, options: { force?: boolean; dryRun?: boolean }) {
        if (options.dryRun) {
            console.log(`[DRY RUN] Would write to: ${path}`);
            return;
        }

        const exists = await this.fileExists(path);
        if (exists && !options.force) {
            throw new Error(`File already exists: ${path}. Use --force to overwrite.`);
        }

        await this.ensureDir(path);
        await writeFile(path, content, "utf-8");
    }
}
