import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export async function setGoal(goal: string, cwd: string = process.env.NOOA_PROJECT_ROOT || process.cwd()) {
    const path = join(cwd, ".nooa", "GOAL.md");
    // Ensure .nooa exists (defensive programming)
    await mkdir(join(cwd, ".nooa"), { recursive: true });

    const content = `# Current Goal

${goal}

---
Set: ${new Date().toISOString()}`;
    await Bun.write(path, content);
}

export async function getGoal(cwd: string = process.env.NOOA_PROJECT_ROOT || process.cwd()): Promise<string | null> {
    const path = join(cwd, ".nooa", "GOAL.md");
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    return file.text();
}

export async function clearGoal(cwd: string = process.env.NOOA_PROJECT_ROOT || process.cwd()) {
    const path = join(cwd, ".nooa", "GOAL.md");
    const file = Bun.file(path);
    if (await file.exists()) {
        await Bun.write(path, "# No active goal\n");
    }
}
