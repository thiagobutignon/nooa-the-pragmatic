# Semantic Search Option A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve semantic search quality and cost by adding structure-aware chunking, batched embeddings, and query embedding cache while keeping the current vector search pipeline.

**Architecture:** Keep `executeSearch` as the single semantic retrieval entrypoint, but improve index chunking and embed batching for indexing, plus add a lightweight LRU cache for query embeddings. Use existing `embedText` and SQLite store; avoid behavioral changes to ranking beyond better input quality.

**Tech Stack:** TypeScript, Bun, SQLite store, existing embedding providers (ollama/mock), existing guardrail/test setup.

---

### Task 1: Add Structure-Aware Chunking (No AST Dependency)

**Files:**
- Modify: `src/features/index/execute.ts`
- Test: `src/features/index/index.test.ts`

**Step 1: Write failing test for chunker behavior**

Add a test that calls `chunkText` (export it for test) and verifies:
- It splits long content into multiple chunks.
- It preserves line boundaries and applies overlap.

```typescript
import { describe, expect, test } from "bun:test";
import { chunkText } from "./execute";

test("chunkText splits with overlap and respects line boundaries", () => {
  const input = Array.from({ length: 120 }, (_, i) => `line-${i}`).join("\n");
  const chunks = chunkText(input, { maxChars: 200, overlapLines: 5 });
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks[0]).toContain("line-0");
  expect(chunks[1]).toContain("line-5");
});

test("chunkText keeps top-level boundaries when markers exist", () => {
  const input = [
    "export function alpha() {}",
    "",
    "export function beta() {}",
    "",
    "export class Gamma {}",
  ].join("\n");
  const chunks = chunkText(input, { maxChars: 50, overlapLines: 2 });
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks[0]).toContain("alpha");
  expect(chunks[1]).toContain("beta");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/index/index.test.ts`
Expected: FAIL because `chunkText` is not exported / new signature not implemented.

**Step 3: Implement structure-aware chunker**

In `src/features/index/execute.ts`, update `chunkText` to:
- Accept options `{ maxChars: number; overlapLines: number; }`.
- Prefer splitting at boundary markers before size cutoff:
  - `export function`, `export class`, `export const`, `function`, `class`.
  - For markdown: split at `^#` headings when present.
- When no boundary markers are found, fall back to line-accumulation.
- Overlap last `overlapLines` lines into the next chunk.
- Export `chunkText` for tests.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/index/index.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/index/execute.ts src/features/index/index.test.ts
git commit -m "feat: add structure-aware chunking for index"
```

---

### Task 2: Batch Embeddings in Indexer (Defensive)

**Files:**
- Modify: `src/features/index/execute.ts`
- Test: `src/features/index/index.test.ts`

**Step 1: Write failing test for batch embedding usage**

Add a test that spies on `AiEngine.embed` to ensure it’s called once per batch, not per chunk.

```typescript
import { describe, expect, test, spyOn } from "bun:test";
import { AiEngine } from "../ai/engine";
import { indexFile } from "./execute";

// Setup: spy and mock embed
```

Expected: FAIL because current code embeds per chunk.

**Step 2: Run test to verify it fails**

Run: `bun test src/features/index/index.test.ts`
Expected: FAIL with call count > 1.

**Step 3: Implement defensive batch embedding in `indexFile`**

- Collect chunk array first.
- Call `ai.embed({ input: chunks })` once.
- If embeddings length mismatches, fall back to per-chunk embed.
- If a chunk embed fails, skip that chunk (do not crash indexing).

**Step 4: Run test to verify it passes**

Run: `bun test src/features/index/index.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/index/execute.ts src/features/index/index.test.ts
git commit -m "feat: batch embeddings during indexing"
```

---

### Task 3: Add Query Embedding Cache (Normalized Keys)

**Files:**
- Modify: `src/features/index/execute.ts`
- Test: `src/features/index/index.test.ts`

**Step 1: Write failing test for cache hit**

Add a test that calls `executeSearch` twice with the same query and expects `AiEngine.embed` to be called once.

**Step 2: Run test to verify it fails**

Run: `bun test src/features/index/index.test.ts`
Expected: FAIL (embed called twice).

**Step 3: Implement LRU cache for query embeddings**

- Add a small LRU (size ~100) inside module scope.
- Normalize cache key: lowercase, collapse whitespace, trim, cap length.
- Cache by `provider:model:normalizedQuery`.
- On cache hit, skip embed call.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/index/index.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/index/execute.ts src/features/index/index.test.ts
git commit -m "feat: cache query embeddings for search"
```

---

### Task 4: Add Golden-Set Quality Tests (Deterministic Fixtures)

**Files:**
- Modify: `src/features/index/index.test.ts`

**Step 1: Write failing golden-set test with fixtures**

Create a temp fixture repo inside the test, index it, and validate top-3 contains expected files:

```typescript
const FIXTURES = {
  "auth/login.ts": "export function login() {}",
  "auth/jwt.ts": "export function signJwt() {}",
  "db/pool.ts": "export function connectDb() {}",
};

test("semantic search quality regression (fixtures)", async () => {
  // write fixtures to temp dir
  // set NOOA_DB_PATH to a temp sqlite file
  // clearIndex(), indexRepo(tempDir)
  const results = await executeSearch("authentication logic", 5);
  const top = results.slice(0, 3).map((r) => r.path);
  expect(top).toContain("auth/login.ts");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/index/index.test.ts`
Expected: FAIL until index/search changes land.

**Step 3: Adjust fixtures or thresholds to stabilize**

- Ensure fixtures are indexed under temp dir.
- Ensure test uses isolated NOOA_DB_PATH and clears index before/after.
- Set minScore low enough to allow recall.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/index/index.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/index/index.test.ts
git commit -m "test: add semantic search golden set"
```

---

### Task 5: Wire Ask/Context to Shared Search Defaults

**Files:**
- Modify: `src/features/ask/cli.ts`
- Modify: `src/features/context/engine.ts`
- Modify: `src/features/prompt/assembler.ts`
- Test: `src/features/ask/cli.test.ts`

**Step 1: Write failing test for ask to reuse executeSearch defaults**

Update ask test to confirm default limit and consistent results shape after caching and chunking changes.

**Step 2: Run test to verify it fails**

Run: `bun test src/features/ask/cli.test.ts`
Expected: FAIL if new defaults differ.

**Step 3: Adjust ask/context/prompt to use shared defaults**

- Centralize defaults in `executeSearch` (limit, minScore).
- ContextEngine uses same `minScore` threshold for memory search.
- PromptAssembler only uses ContextEngine output (no duplicate thresholds).

**Step 4: Run test to verify it passes**

Run: `bun test src/features/ask/cli.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/ask/cli.ts src/features/context/engine.ts src/features/prompt/assembler.ts src/features/ask/cli.test.ts
git commit -m "feat: unify semantic search defaults"
```

---

### Task 6: Full Test Run

**Files:**
- None

**Step 1: Run full suite**

Run: `bun test`
Expected: PASS (exit code 1 due to coverage gating is acceptable if consistent with repo behavior).

**Step 2: Commit (if needed)**

If no extra changes, skip.

---

Plan complete and saved to `docs/plans/2026-02-11-semantic-search-option-a.md`.

Two execution options:
1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
