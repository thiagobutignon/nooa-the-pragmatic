# nooa context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a surgical context pack for AI consumption: relevant files, symbols, tests, conventions, and recent commits.

**Architecture:** Analyze input (file/symbol/issue) and bundle related context with source citations.

**Tech Stack:** Bun, TypeScript, execa, tree-sitter (optional).

---

### Task 1: File Context Extraction

**Files:**
- Create: `src/features/context/execute.ts`
- Test: `src/features/context/execute.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe } from "bun:test";
import { buildContext } from "./execute";

describe("Context Builder", () => {
    test("extracts related files for a given file", async () => {
        const result = await buildContext("src/core/logger.ts");
        expect(result).toHaveProperty("target");
        expect(result).toHaveProperty("related");
        expect(result).toHaveProperty("tests");
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/context/execute.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/features/context/execute.ts
import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { dirname, basename, join } from "node:path";

export interface ContextResult {
    target: string;
    content: string;
    related: string[];
    tests: string[];
    recentCommits: string[];
}

export async function buildContext(filePath: string): Promise<ContextResult> {
    const content = await readFile(filePath, "utf-8");
    const dir = dirname(filePath);
    const base = basename(filePath, ".ts");

    // Find related files (imports)
    const importMatches = content.match(/from ["']\.\/([^"']+)["']/g) || [];
    const related = importMatches.map(m => join(dir, m.replace(/from ["']\.\//, "").replace(/["']/, "") + ".ts"));

    // Find test files
    const testPath = filePath.replace(".ts", ".test.ts");
    const tests = [testPath];

    // Recent commits
    const { stdout } = await execa("git", ["log", "--oneline", "-5", "--", filePath], { reject: false });
    const recentCommits = stdout.split("\n").filter(Boolean);

    return { target: filePath, content, related, tests, recentCommits };
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/features/context/
git commit -m "feat: implement context extraction"
```

---

### Task 2: CLI Command `nooa context`

**Files:**
- Create: `src/features/context/cli.ts`

**Step 1: Write the failing test**

```typescript
test("outputs context for a file", async () => {
    const { stdout, exitCode } = await execa("bun", ["index.ts", "context", "src/core/logger.ts", "--json"], { reject: false });
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("target");
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

```typescript
// src/features/context/cli.ts
import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { buildContext } from "./execute";

const contextHelp = `
Usage: nooa context <file|symbol> [flags]

Generate context pack for AI consumption.

Flags:
  --json         Output as JSON.
  -h, --help     Show help.
`;

const contextCommand: Command = {
    name: "context",
    description: "Generate AI context pack",
    execute: async ({ rawArgs }: CommandContext) => {
        const { values, positionals } = parseArgs({
            args: rawArgs,
            options: { help: { type: "boolean", short: "h" }, json: { type: "boolean" } },
            allowPositionals: true, strict: false
        });
        if (values.help) { console.log(contextHelp); return; }

        const target = positionals[1];
        if (!target) { console.error("Error: File required"); process.exitCode = 2; return; }

        const result = await buildContext(target);
        if (values.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`Target: ${result.target}`);
            console.log(`Related: ${result.related.join(", ") || "none"}`);
            console.log(`Tests: ${result.tests.join(", ")}`);
            console.log(`Recent Commits: ${result.recentCommits.length}`);
        }
    }
};

export default contextCommand;
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/features/context/
git commit -m "feat: add nooa context command"
```
