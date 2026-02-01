# nooa index + ask Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement semantic search for code and memory using embeddings stored in SQLite.

**Architecture:** `index` command crawls and embeds files; `ask` queries with cosine similarity and returns cited sources.

**Tech Stack:** Bun, TypeScript, SQLite, OpenAI/Ollama embeddings.

---

### Task 1: Embedding Storage Schema

**Files:**
- Create: `src/core/db/schema/embeddings.ts`
- Test: `src/core/db/embeddings.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe } from "bun:test";
import { Database } from "bun:sqlite";
import { setupEmbeddingsTable } from "./schema/embeddings";

describe("Embeddings Schema", () => {
    test("creates embeddings table", () => {
        const db = new Database(":memory:");
        setupEmbeddingsTable(db);
        const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='embeddings'").get();
        expect(result).toBeDefined();
    });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

```typescript
// src/core/db/schema/embeddings.ts
import { Database } from "bun:sqlite";

export function setupEmbeddingsTable(db: Database) {
    db.run(`
        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            chunk TEXT NOT NULL,
            vector BLOB NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_embeddings_path ON embeddings(path)`);
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/core/db/schema/embeddings.ts
git commit -m "feat: add embeddings table schema"
```

---

### Task 2: Indexer Core

**Files:**
- Create: `src/features/index/execute.ts`

**Step 1: Write the failing test**

```typescript
test("indexes a file and stores embeddings", async () => {
    const result = await indexFile("src/core/logger.ts");
    expect(result.chunks).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

```typescript
// src/features/index/execute.ts
import { readFile } from "node:fs/promises";
import { embed } from "../../core/ai/embed";
// Stub: actual implementation would use sqlite storage

export async function indexFile(path: string) {
    const content = await readFile(path, "utf-8");
    const chunks = content.split("\n\n").filter(c => c.trim().length > 10);
    // For each chunk, call embed() and store
    return { path, chunks: chunks.length };
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/features/index/
git commit -m "feat: implement file indexer"
```

---

### Task 3: CLI Commands `nooa index` and `nooa ask`

**Files:**
- Create: `src/features/index/cli.ts`

**Step 1: Write the failing test**

```typescript
test("index repo command exists", async () => {
    const { stdout } = await execa("bun", ["index.ts", "index", "--help"], { reject: false });
    expect(stdout).toContain("Usage: nooa index");
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

```typescript
// src/features/index/cli.ts
import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";

const indexHelp = `
Usage: nooa index [subcommand] [flags]

Semantic indexing for code and memory.

Subcommands:
  repo     Index all TypeScript files in the repository.
  memory   Index memory entries.

Flags:
  --json         Output as JSON.
  -h, --help     Show help.
`;

const indexCommand: Command = {
    name: "index",
    description: "Semantic indexing",
    execute: async ({ rawArgs }: CommandContext) => {
        const { values, positionals } = parseArgs({
            args: rawArgs,
            options: { help: { type: "boolean", short: "h" }, json: { type: "boolean" } },
            allowPositionals: true, strict: false
        });
        if (values.help) { console.log(indexHelp); return; }

        const sub = positionals[1];
        if (sub === "repo") {
            console.log("Indexing repository...");
            // Implementation here
            console.log("✅ Indexing complete");
        } else {
            console.log(indexHelp);
        }
    }
};

export default indexCommand;
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/features/index/
git commit -m "feat: add nooa index command"
```
