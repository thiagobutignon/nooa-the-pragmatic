import { expect, test, describe, beforeEach } from "bun:test";
import { Discovery } from "./Discovery";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Discovery", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `nooa-skills-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    test("lists available skills in directory", async () => {
        const skillPath = join(testDir, "test-skill");
        await mkdir(skillPath, { recursive: true });
        await writeFile(join(skillPath, "SKILL.md"), "---\nname: test-skill\n---");

        const discovery = new Discovery(testDir);
        const skills = await discovery.list();
        expect(skills).toContain("test-skill");
    });
});
