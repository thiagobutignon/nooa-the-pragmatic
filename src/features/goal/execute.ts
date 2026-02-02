import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export async function setGoal(goal: string, cwd: string = process.cwd()) {
    const path = join(cwd, ".nooa", "GOAL.md");
    const content = `# Current Goal

${goal}

---
Set: ${new Date().toISOString()}`;
    await writeFile(path, content);
}

export async function getGoal(cwd: string = process.cwd()): Promise<string | null> {
    const path = join(cwd, ".nooa", "GOAL.md");
    if (!existsSync(path)) return null;
    return readFile(path, "utf-8");
}

export async function clearGoal(cwd: string = process.cwd()) {
    const path = join(cwd, ".nooa", "GOAL.md");
    if (existsSync(path)) {
        await writeFile(path, "# No active goal\n");
    }
}
