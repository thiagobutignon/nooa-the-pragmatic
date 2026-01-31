# Semantic Search (MVP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `nooa search --semantic` that embeds explicit paths, chunks content (800/120), and returns top‑k semantic matches.

**Architecture:** Extend `src/features/search/cli.ts` with a `--semantic` flag that delegates to a new semantic engine (`semantic.ts`). The engine reads files from explicit paths, chunks content, embeds query + chunks via `embedText`, computes cosine similarity, and returns top‑k matches. No persistence or caching in MVP. Shared math utilities (cosine) live in `src/core/algorithms/` for reuse.

**Tech Stack:** Bun, TypeScript, existing `embed` engine, telemetry.

---

### Task 1: Add chunking utility + unit test

**Files:**
- Create: `src/features/search/semantic.ts`
- Create: `src/features/search/semantic.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { chunkText } from "./semantic";

describe("semantic chunking", () => {
  it("chunks with 800 chars and 120 overlap", () => {
    const text = "a".repeat(2000);
    const chunks = chunkText(text, 800, 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text.length).toBe(800);
    expect(chunks[1].start).toBe(680);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/search/semantic.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export function chunkText(text: string, size = 800, overlap = 120) {
  const chunks: { text: string; start: number; end: number }[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push({ text: text.slice(start, end), start, end });
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/search/semantic.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/search/semantic.ts src/features/search/semantic.test.ts
git commit -m "feat: add semantic chunking"
```

---

### Task 2: Semantic engine scoring + mock embed test

**Files:**
- Create: `src/core/algorithms/cosine.ts`
- Modify: `src/features/search/semantic.ts`
- Modify: `src/features/search/semantic.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { semanticSearch } from "./semantic";

process.env.NOOA_EMBED_PROVIDER = "mock";

it("ranks chunks by cosine similarity", async () => {
  const files = [
    { path: "a.txt", content: "hello world" },
    { path: "b.txt", content: "unrelated content" },
  ];
  const results = await semanticSearch({
    query: "hello",
    files,
    topK: 1,
  });
  expect(results[0].path).toBe("a.txt");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/search/semantic.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

- Add `cosineSimilarity(a, b)` in `src/core/algorithms/cosine.ts`
- Add `semanticSearch({ query, files, topK })`
- Use `embedText` for query + chunks
- Return results with `{ path, start, end, score, snippet }`

**Step 4: Run test to verify it passes**

Run: `bun test src/features/search/semantic.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/algorithms/cosine.ts src/features/search/semantic.ts src/features/search/semantic.test.ts
git commit -m "feat: add semantic search scoring"
```

---

### Task 3: CLI flag `--semantic` + explicit paths only

**Files:**
- Modify: `src/features/search/cli.ts`
- Modify: `src/features/search/cli.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";
import { writeFile } from "node:fs/promises";

const binPath = "./index.ts";

it("returns semantic results for explicit path", async () => {
  await writeFile("tmp-sem.txt", "hello world");
  const res = await execa("bun", [binPath, "search", "--semantic", "hello", "tmp-sem.txt"], {
    reject: false,
    env: { ...process.env, NOOA_EMBED_PROVIDER: "mock" },
  });
  const json = JSON.parse(res.stdout);
  expect(json.results.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/search/cli.test.ts`  
Expected: FAIL

**Step 3: Implement minimal behavior**

- Parse `--semantic` flag in `search` command
- If `--semantic`, build file list from explicit path (file only for MVP)
- Call `semanticSearch` and output JSON `{ results, query, top_k }`
- Ensure no implicit scanning of repo

**Step 4: Run test to verify it passes**

Run: `bun test src/features/search/cli.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/search/cli.ts src/features/search/cli.test.ts
 git commit -m "feat: add semantic search flag"
```

---

### Task 4: Telemetry

**Files:**
- Modify: `src/features/search/cli.ts`
- Modify: `src/features/search/cli.test.ts`

**Step 1: Write failing test**

```ts
// Verify search.semantic.started/success/failure events
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/search/cli.test.ts`  
Expected: FAIL

**Step 3: Implement telemetry**

- Events: `search.semantic.started`, `search.semantic.success`, `search.semantic.failure`
- Metadata: paths_count, chunks_count, provider, model, top_k, duration_ms

**Step 4: Run test to verify it passes**

Run: `bun test src/features/search/cli.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/search/cli.ts src/features/search/cli.test.ts
 git commit -m "feat: add semantic search telemetry"
```

---

### Task 5: Docs

**Files:**
- Modify: `docs/commands/search.md`

**Step 1: Write doc updates**

Add `--semantic`, `--top-k`, chunking behavior (800/120), explicit paths requirement.

**Step 2: Commit**

```bash
git add docs/commands/search.md
 git commit -m "docs: add semantic search"
```

---

**Post-implementation:** Run full suite: `bun test --coverage`
