export type MemoryType = "decision" | "fact" | "preference" | "rule" | "gotcha";
export type MemoryScope = "project" | "user" | "repo" | "command";
export type MemoryConfidence = "low" | "medium" | "high";

export interface MemoryEntry {
    id: string;
    timestamp: string;
    trace_id?: string;
    type: MemoryType;
    scope: MemoryScope;
    confidence: MemoryConfidence;
    tags: string[];
    sources: string[];
    content: string;
}

export function formatMemoryAsMarkdown(entry: MemoryEntry): string {
    const { content, ...metadata } = entry;
    const yaml = require("js-yaml");
    const frontmatter = yaml.dump(metadata).trim();
    return `---\n${frontmatter}\n---\n\n${content}\n`;
}

export function parseMemoryFromMarkdown(markdown: string): MemoryEntry {
    const yaml = require("js-yaml");
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/);
    if (!match || !match[1] || !match[2]) {
        throw new Error("Invalid memory format: Missing or malformed YAML frontmatter.");
    }
    const metadata = yaml.load(match[1]) as Omit<MemoryEntry, "content">;
    return {
        ...metadata,
        content: match[2].trim()
    };
}
