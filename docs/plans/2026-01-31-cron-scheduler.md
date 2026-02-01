# Cron Scheduler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform NOOA from a reactive CLI into an autonomous, recurring agent by implementing a robust scheduling system.

**Architecture:** A `CronEngine` will manage job definitions and execution history in a SQLite database. A `tick` command will be the heartbeat, triggered by OS-level schedulers (crontab).

**Tech Stack:** Bun, TypeScript, SQLite (Better-SQLite3 or equivalent), node-cron (for parsing).

---

### Task 1: Cron DB Schema & Migration

**Files:**
- Create: `src/core/db/schema/cron.ts`
- Modify: `src/core/db/index.ts`
- Test: `src/core/db/cron.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { setupCronTable } from "./schema/cron";

describe("Cron DB Schema", () => {
    let db: Database;

    beforeEach(() => {
        db = new Database(":memory:");
    });

    test("can create cron_jobs table", () => {
        setupCronTable(db);
        const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='cron_jobs'").get();
        expect(result).toBeDefined();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/db/cron.test.ts`
Expected: FAIL (setupCronTable is not defined)

**Step 3: Write minimal implementation**

```typescript
// src/core/db/schema/cron.ts
import { Database } from "bun:sqlite";

export function setupCronTable(db: Database) {
    db.run(`
        CREATE TABLE IF NOT EXISTS cron_jobs (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            schedule TEXT NOT NULL,
            command TEXT NOT NULL,
            next_run_at TEXT,
            enabled INTEGER DEFAULT 1
        )
    `);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/db/cron.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/db/schema/cron.ts
git commit -m "feat: add cron_jobs table schema"
```

---

### Task 2: CLI Command `nooa cron add`

**Files:**
- Create: `src/features/cron/cli.ts`
- Modify: `index.ts`
- Test: `src/features/cron/cli.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe } from "bun:test";
import { execa } from "execa";

describe("cron cli", () => {
    test("add command requires name and schedule", async () => {
        const { stderr, exitCode } = await execa("bun", ["index.ts", "cron", "add"], { reject: false });
        expect(exitCode).toBe(2);
        expect(stderr).toContain("Error: Name and schedule are required");
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/cron/cli.test.ts`
Expected: FAIL (Unknown subcommand 'cron')

**Step 3: Write minimal implementation**

```typescript
// src/features/cron/cli.ts
import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";

const cronHelp = `
Usage: nooa cron <subcommand> [args]

Manage recurring jobs.

Subcommands:
  add <name> --every <schedule> -- <command...>
`;

const cronCommand: Command = {
    name: "cron",
    description: "Manage recurring jobs",
    execute: async ({ rawArgs }: CommandContext) => {
        const { values, positionals } = parseArgs({
            args: rawArgs,
            options: {
                every: { type: "string" }
            },
            allowPositionals: true,
            strict: false
        });

        const subcommand = positionals[1];
        if (subcommand === "add") {
            const name = positionals[2];
            const schedule = values.every;
            if (!name || !schedule) {
                console.error("Error: Name and schedule are required for 'add'.");
                process.exitCode = 2;
                return;
            }
            // Implementation for DB storage
            console.log(`✅ Job '${name}' added with schedule '${schedule}'.`);
            return;
        }
        console.log(cronHelp);
    }
};

export default cronCommand;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/cron/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/cron/cli.ts
git commit -m "feat: add cron add command shell"
```
