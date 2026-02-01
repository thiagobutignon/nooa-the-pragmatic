import { join } from "node:path";
import { readFile, mkdir, appendFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { type MemoryEntry, formatMemoryAsMarkdown, parseMemoryFromMarkdown } from "../../core/memory/schema";
import { runSearch } from "../search/engine";
import { createTraceId, logger } from "../../core/logger";
import { summarizeMemory } from "./summarize";

export interface MemorySearchOptions {
    lexical?: boolean;
    semantic?: boolean;
    root?: string;
}

export class MemoryEngine {
    private root: string;
    private memoryDir: string;
    private durablePath: string;
    private lockPath: string;

    constructor(root: string = process.cwd()) {
        this.root = root;
        this.memoryDir = join(this.root, "memory");
        this.durablePath = join(this.root, ".nooa/MEMORY.md");
        this.lockPath = join(this.root, ".nooa/memory.lock");
    }

    private async ensureDirs() {
        await mkdir(this.memoryDir, { recursive: true });
        await mkdir(join(this.root, ".nooa"), { recursive: true });
    }

    private async acquireLock(timeoutMs = 2000): Promise<void> {
        const start = Date.now();
        while (existsSync(this.lockPath)) {
            if (Date.now() - start > timeoutMs) {
                throw new Error("Timeout acquiring memory lock.");
            }
            await new Promise(r => setTimeout(r, 50));
        }
        await writeFile(this.lockPath, process.pid.toString());
    }

    private async releaseLock(): Promise<void> {
        try {
            await unlink(this.lockPath);
        } catch {
            // Ignore missing lock
        }
    }

    async addEntry(entry: Omit<MemoryEntry, "id" | "timestamp">): Promise<MemoryEntry> {
        await this.ensureDirs();
        const fullEntry: MemoryEntry = {
            ...entry,
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date().toISOString(),
            trace_id: entry.trace_id || createTraceId()
        };

        const date = fullEntry.timestamp.split("T")[0];
        const dailyPath = join(this.memoryDir, `${date}.md`);
        const content = formatMemoryAsMarkdown(fullEntry);

        await this.acquireLock();
        try {
            await appendFile(dailyPath, `\n${content}\n`);
            
            // Generate and store embedding
            try {
                const { embedText } = await import("../embed/engine");
                const { store } = await import("../../core/db/index");
                const { embedding } = await embedText(fullEntry.content, {});
                await store.storeEmbedding(fullEntry.id, fullEntry.content, embedding);
            } catch (e) {
                logger.warn("memory.embedding_failed", { error: (e as Error).message });
            }
        } finally {
            await this.releaseLock();
        }
        return fullEntry;
    }

    async getEntryById(id: string): Promise<MemoryEntry | null> {
        const results = await runSearch({
            query: id,
            root: this.root,
            include: ["**/memory/*.md", "**/.nooa/MEMORY.md"],
            regex: false,
            context: 0
        });

        const filePath = results[0]?.path;
        if (!filePath) return null;

        const fileContent = await readFile(filePath, "utf-8");
        const blockRegex = /---\r?\n[\s\S]*?\r?\n---\r?\n?[\s\S]*?(?=\r?\n---\r?\n|$)/g;
        const blocks = fileContent.match(blockRegex) || [];

        for (const block of blocks) {
            try {
                const entry = parseMemoryFromMarkdown(block.trim());
                if (entry.id === id) return entry;
            } catch {
                continue;
            }
        }

        return null;
    }

    async promoteEntry(id: string): Promise<void> {
        const entry = await this.getEntryById(id);
        if (!entry) throw new Error(`Memory entry with ID ${id} not found.`);

        const markdown = formatMemoryAsMarkdown(entry);
        
        await this.acquireLock();
        try {
            await appendFile(this.durablePath, `\n${markdown}\n`);
            // Automated context invalidation/update
            await summarizeMemory(this.root);
        } finally {
            await this.releaseLock();
        }
    }

    async search(query: string, options: MemorySearchOptions = {}): Promise<MemoryEntry[]> {
        if (options.semantic) {
            return this.searchSemantic(query);
        }

        const lexicalResults = await runSearch({
            query,
            root: this.root,
            include: ["**/memory/*.md", "**/.nooa/MEMORY.md"],
            regex: true,
            ignoreCase: true,
            noIgnore: true
        });
        
        const entryIds = new Set<string>();
        const entries: MemoryEntry[] = [];

        for (const result of lexicalResults) {
            const fileContent = await readFile(result.path, "utf-8");
            const blockRegex = /---\r?\n[\s\S]*?---\r?\n?[\s\S]*?(?=\r?\n---\r?\n|$)/g;
            const blocks = fileContent.match(blockRegex) || [];
            
            for (const block of blocks) {
                try {
                    const entry = parseMemoryFromMarkdown(block.trim());
                    const searchBatch = [
                        entry.content,
                        entry.id,
                        ...(entry.tags || []),
                        entry.type,
                        entry.scope
                    ].join(" ").toLowerCase();

                    if (searchBatch.includes(query.toLowerCase())) {
                         if (!entryIds.has(entry.id)) {
                            entryIds.add(entry.id);
                            entries.push(entry);
                         }
                    }
                } catch {
                    continue;
                }
            }
        }

        return entries;
    }

    async searchSemantic(query: string): Promise<MemoryEntry[]> {
        const { embedText } = await import("../embed/engine");
        const { store } = await import("../../core/db/index");
        
        const { embedding } = await embedText(query, {});
        const results = await store.searchEmbeddings(embedding, 10);
        
        const entries: MemoryEntry[] = [];
        for (const res of results) {
            const entry = await this.getEntryById(res.path); // res.path stores the memory ID
            if (entry) entries.push(entry);
        }
        return entries;
    }
}
