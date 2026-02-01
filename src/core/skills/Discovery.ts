import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export class Discovery {
    constructor(private skillsDir: string) {}

    async list(): Promise<string[]> {
        if (!existsSync(this.skillsDir)) {
            return [];
        }
        
        const entries = await readdir(this.skillsDir, { withFileTypes: true });
        const skills: string[] = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const metadataPath = join(this.skillsDir, entry.name, "SKILL.md");
                if (existsSync(metadataPath)) {
                    skills.push(entry.name);
                }
            }
        }
        return skills;
    }
}
