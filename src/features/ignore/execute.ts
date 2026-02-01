import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export async function loadIgnore(cwd: string = process.cwd()): Promise<string[]> {
    const path = join(cwd, ".nooa-ignore");
    if (!existsSync(path)) return [];
    const content = await readFile(path, "utf-8");
    return content.split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"));
}

export async function saveIgnore(patterns: string[], cwd: string = process.cwd()) {
    const path = join(cwd, ".nooa-ignore");
    const header = "# NOOA Policy Ignore\n# Add patterns to ignore files or directories from Zero-Preguiça audits.\n\n";
    await writeFile(path, header + patterns.join("\n") + "\n");
}

export async function addPattern(pattern: string, cwd: string = process.cwd()) {
    const patterns = await loadIgnore(cwd);
    if (!patterns.includes(pattern)) {
        patterns.push(pattern);
        await saveIgnore(patterns, cwd);
        return true;
    }
    return false;
}

export async function removePattern(pattern: string, cwd: string = process.cwd()) {
    const patterns = await loadIgnore(cwd);
    const initialLength = patterns.length;
    const filtered = patterns.filter(p => p !== pattern);
    if (filtered.length < initialLength) {
        await saveIgnore(filtered, cwd);
        return true;
    }
    return false;
}
