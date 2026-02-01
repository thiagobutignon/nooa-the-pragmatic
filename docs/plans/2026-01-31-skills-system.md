# Skills System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a standardized way to define, discover, and invoke "Skills" to extend NOOA capabilities.

**Architecture:** Skills are self-contained directories with standardized metadata (SKILL.md) and scripts. A `SkillEngine` will handle discovery and loading, while the CLI will provide management commands.

**Tech Stack:** Bun, TypeScript, Node.js fs/path.

---

### Task 1: Skill Discovery Core

**Files:**
- Create: `src/core/skills/Discovery.ts`
- Create: `src/core/skills/types.ts`
- Test: `src/core/skills/Discovery.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe, beforeEach } from "bun:test";
import { Discovery } from "./Discovery";
import { mkdir, writeFile, rm } from "node:fs/promises";
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
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/skills/Discovery.test.ts`
Expected: FAIL (Cannot find module './Discovery')

**Step 3: Write minimal implementation**

```typescript
// src/core/skills/types.ts
export interface SkillMetadata {
    name: string;
    description?: string;
}

// src/core/skills/Discovery.ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export class Discovery {
    constructor(private skillsDir: string) {}

    async list(): Promise<string[]> {
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
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/skills/Discovery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/skills/
git commit -m "feat: implement basic skill discovery"
```

---

### Task 2: CLI Command `nooa skills list`

**Files:**
- Create: `src/features/skills/cli.ts`
- Modify: `index.ts`
- Test: `src/features/skills/cli.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe } from "bun:test";
import { execa } from "execa";

describe("skills cli", () => {
    test("list command returns 200 and listed skills", async () => {
        const { stdout, exitCode } = await execa("bun", ["index.ts", "skills", "list"], { reject: false });
        expect(exitCode).toBe(0);
        expect(stdout).toContain("Current skills:");
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/skills/cli.test.ts`
Expected: FAIL (Unknown subcommand 'skills')

**Step 3: Write minimal implementation**

```typescript
// src/features/skills/cli.ts
import type { Command, CommandContext } from "../../core/command";
import { Discovery } from "../../core/skills/Discovery";
import { join } from "node:path";

const skillsHelp = `
Usage: nooa skills [subcommand] [flags]

Manage NOOA skills.

Subcommands:
  list    List all available skills.
`;

const skillsCommand: Command = {
    name: "skills",
    description: "Manage NOOA skills",
    execute: async ({ rawArgs }: CommandContext) => {
        const subcommand = rawArgs[1];
        if (subcommand === "list") {
            const discovery = new Discovery(join(process.cwd(), ".agent/skills"));
            const list = await discovery.list();
            console.log("Current skills:");
            for (const s of list) console.log(`  - ${s}`);
            return;
        }
        console.log(skillsHelp);
    }
};

export default skillsCommand;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/skills/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/skills/ index.ts
git commit -m "feat: add skills list command"
```
