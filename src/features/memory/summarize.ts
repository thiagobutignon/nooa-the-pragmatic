import { writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { type MemoryEntry, parseMemoryFromMarkdown } from "../../core/memory/schema";

/**
 * Summarizes the most relevant memory entries for prompt context.
 * Policy:
 * 1. Include durable entries (.nooa/MEMORY.md)
 * 2. Include recent daily entries (last 3 files)
 * 3. Filter: Only confidence >= medium and has sources
 * 4. Deterministic: Sort by timestamp DESC, limit total size.
 */
export async function summarizeMemory(root: string = process.cwd()) {
    const memoryDir = join(root, "memory");
    const durablePath = join(root, ".nooa/MEMORY.md");
    const summaryPath = join(root, ".nooa/MEMORY_SUMMARY.md");
    
    const entries: MemoryEntry[] = [];

    // 1. Process Durable Memory
    try {
        const durableContent = await readFile(durablePath, "utf-8");
        processBlocks(durableContent, entries);
    } catch { /* skip missing durable */ }

    // 2. Process Recent Daily Memory
    try {
        const files = (await readdir(memoryDir))
            .filter(f => f.endsWith(".md"))
            .sort()
            .reverse()
            .slice(0, 3);
        
        for (const file of files) {
            const content = await readFile(join(memoryDir, file), "utf-8");
            processBlocks(content, entries);
        }
    } catch { /* skip missing daily */ }

    // 3. Filter Policy: Confidence >= Medium AND has sources
    const filtered = entries.filter(e => {
        const isReliable = e.confidence === "medium" || e.confidence === "high";
        const hasSources = (e.sources && e.sources.length > 0) || (e.trace_id);
        return isReliable && hasSources;
    });

    // 4. Sort and Format
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    // De-duplicate by ID (durable might repeat daily)
    const uniqueMap = new Map<string, MemoryEntry>();
    for (const e of filtered) {
        if (!uniqueMap.has(e.id)) uniqueMap.set(e.id, e);
    }
    const unique = Array.from(uniqueMap.values()).slice(0, 20); // Limit to top 20

    let summary = "# NOOA MEMORY SUMMARY\n";
    summary += "> Context curated for high-integrity results. Precedence: Constitution.\n\n";
    
    const grouped = unique.reduce((acc, entry) => {
        const type = entry.type || "fact";
        if (!acc[type]) acc[type] = [];
        acc[type].push(entry);
        return acc;
    }, {} as Record<string, MemoryEntry[]>);

    for (const [type, typeEntries] of Object.entries(grouped)) {
        summary += `### Recent ${type.charAt(0).toUpperCase() + type.slice(1)}s\n`;
        typeEntries.forEach(e => {
            const date = e.timestamp.split("T")[0];
            summary += `- [${date}] ${e.content}\n`;
        });
        summary += "\n";
    }

    await writeFile(summaryPath, summary.trim());
    return summaryPath;
}

function processBlocks(content: string, entries: MemoryEntry[]) {
    const blockRegex = /---\r?\n[\s\S]*?\r?\n---\r?\n?[\s\S]*?(?=\r?\n---\r?\n|$)/g;
    const blocks = content.match(blockRegex) || [];
    for (const block of blocks) {
        try {
            entries.push(parseMemoryFromMarkdown(block.trim()));
        } catch {
            continue;
        }
    }
}
