# Replay Buffer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new `nooa replay` command that records agent steps as a graph in `.nooa/replay.json`, supports `add`, `link`, `fix`, and `show`, and stays self-describing via CommandBuilder.

**Architecture:** A self-evolving CLI module (`src/features/replay/cli.ts`) stores a minimal DAG model in `.nooa/replay.json`. Nodes are immutable; fixes create new nodes referencing `fixOf` and generate `impact` edges to downstream nodes. CLI is the source of truth.

**Tech Stack:** Bun + TypeScript, CommandBuilder (`src/core/command-builder.ts`), schema spec pattern from `src/features/read/cli.ts`.

---

### Task 1: Scaffold replay feature + first failing test (module not found)

**Files:**
- Create: `src/features/replay/cli.test.ts`
- Create (via scaffold): `src/features/replay/cli.ts`

**Step 1: Write the failing test**

Create `src/features/replay/cli.test.ts` with a simple unit test that imports `run` and asserts it fails cleanly when no subcommand is provided.

```ts
import { describe, expect, test } from "bun:test";
import { run } from "./cli";

describe("replay.run", () => {
  test("fails when action is missing", async () => {
    const result = await run({ action: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("replay.missing_action");
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/replay/cli.test.ts`
Expected: FAIL with “Cannot find module ./cli” (module missing).

**Step 3: Scaffold the command (creates production file)**

Run in worktree root:

```
bun index.ts scaffold command replay
```

Confirm it created `src/features/replay/cli.ts` and `src/features/replay/cli.test.ts` (if scaffold does). If scaffold creates a test file, keep the custom test in `cli.test.ts` and merge/override as needed.

**Step 4: Run test to verify it still fails**

Run: `bun test src/features/replay/cli.test.ts`
Expected: FAIL with missing action error or unimplemented behavior.

**Step 5: Commit**

```
git add src/features/replay/cli.ts src/features/replay/cli.test.ts
git commit -m "feat(replay): scaffold command"
```

---

### Task 2: Implement `add` (create node + persist JSON)

**Files:**
- Modify: `src/features/replay/cli.ts`
- Modify: `src/features/replay/cli.test.ts`
- Create: `src/features/replay/storage.ts`

**Step 1: Write the failing test**

Add a test to create a temp `.nooa/replay.json`, run `add`, and assert node is saved:

```ts
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tmpRoot = join(import.meta.dir, "tmp-replay");

test("add creates a node", async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

  const result = await run({
    action: "add",
    label: "A",
    root: tmpRoot,
  });

  expect(result.ok).toBe(true);
  const raw = await readFile(join(tmpRoot, ".nooa/replay.json"), "utf-8");
  const data = JSON.parse(raw);
  expect(data.nodes.length).toBe(1);
  expect(data.nodes[0].label).toBe("A");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/replay/cli.test.ts`
Expected: FAIL because `add` is unimplemented.

**Step 3: Write minimal implementation**

Implement storage helper in `src/features/replay/storage.ts`:
- `loadReplay(root)` returns empty structure when file missing
- `saveReplay(root, data)` writes JSON

Implement `run()` in `cli.ts` for `add` only.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/replay/cli.test.ts`
Expected: PASS for `add` test.

**Step 5: Commit**

```
git add src/features/replay/cli.ts src/features/replay/cli.test.ts src/features/replay/storage.ts
git commit -m "feat(replay): add node and persist graph"
```

---

### Task 3: Implement `link` (next edge + cycle detection)

**Files:**
- Modify: `src/features/replay/cli.ts`
- Modify: `src/features/replay/cli.test.ts`
- Modify: `src/features/replay/storage.ts`

**Step 1: Write the failing test**

Add test to ensure link creates edge and rejects cycles:

```ts
test("link creates next edge and prevents cycles", async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

  const a = await run({ action: "add", label: "A", root: tmpRoot });
  const b = await run({ action: "add", label: "B", root: tmpRoot });

  expect(a.ok && b.ok).toBe(true);
  if (!a.ok || !b.ok) return;

  const link = await run({ action: "link", from: a.data.id, to: b.data.id, root: tmpRoot });
  expect(link.ok).toBe(true);

  const cycle = await run({ action: "link", from: b.data.id, to: a.data.id, root: tmpRoot });
  expect(cycle.ok).toBe(false);
  if (!cycle.ok) {
    expect(cycle.error.code).toBe("replay.cycle_detected");
  }
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/replay/cli.test.ts`
Expected: FAIL because `link` is missing.

**Step 3: Write minimal implementation**

Add:
- `findNode` helper
- `detectCycle` helper (DFS on `next` edges)
- `link` action in `run()`

**Step 4: Run test to verify it passes**

Run: `bun test src/features/replay/cli.test.ts`
Expected: PASS.

**Step 5: Commit**

```
git add src/features/replay/cli.ts src/features/replay/cli.test.ts src/features/replay/storage.ts
git commit -m "feat(replay): link nodes and prevent cycles"
```

---

### Task 4: Implement `fix` (create fix node + impact edges)

**Files:**
- Modify: `src/features/replay/cli.ts`
- Modify: `src/features/replay/cli.test.ts`
- Modify: `src/features/replay/storage.ts`

**Step 1: Write the failing test**

```ts
test("fix creates node and impact edges", async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

  const a = await run({ action: "add", label: "A", root: tmpRoot });
  const b = await run({ action: "add", label: "B", root: tmpRoot });
  const c = await run({ action: "add", label: "C", root: tmpRoot });
  if (!a.ok || !b.ok || !c.ok) return;

  await run({ action: "link", from: a.data.id, to: b.data.id, root: tmpRoot });
  await run({ action: "link", from: b.data.id, to: c.data.id, root: tmpRoot });

  const fix = await run({ action: "fix", targetId: b.data.id, label: "Fix B", root: tmpRoot });
  expect(fix.ok).toBe(true);

  const raw = await readFile(join(tmpRoot, ".nooa/replay.json"), "utf-8");
  const data = JSON.parse(raw);
  const impactEdges = data.edges.filter((e: any) => e.kind === "impact");
  expect(impactEdges.length).toBeGreaterThanOrEqual(1);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/replay/cli.test.ts`
Expected: FAIL (fix unimplemented).

**Step 3: Write minimal implementation**

Add `fix` action:
- Validate target exists
- Create `fix` node (`type: "fix"`, `fixOf: targetId`)
- Compute downstream nodes via `next` edges
- Add `impact` edges unless `--no-auto-impact`

**Step 4: Run test to verify it passes**

Run: `bun test src/features/replay/cli.test.ts`
Expected: PASS.

**Step 5: Commit**

```
git add src/features/replay/cli.ts src/features/replay/cli.test.ts src/features/replay/storage.ts
git commit -m "feat(replay): add fix nodes and impact edges"
```

---

### Task 5: Implement `show` + CLI surface (help/schema/docs)

**Files:**
- Modify: `src/features/replay/cli.ts`
- Modify: `src/features/replay/cli.test.ts`

**Step 1: Write the failing test**

```ts
test("show returns summary", async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, ".nooa"), { recursive: true });
  await run({ action: "add", label: "A", root: tmpRoot });

  const result = await run({ action: "show", root: tmpRoot });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.nodes).toBeGreaterThanOrEqual(1);
  }
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/replay/cli.test.ts`
Expected: FAIL (show unimplemented).

**Step 3: Write minimal implementation**

Implement `show` action in `run()`:
- Without `id`: return `{ nodes, edges, recent }`
- With `id`: include node detail + downstream `next` nodes

Ensure CLI:
- `readMeta` style fields (meta/help/schema/examples/errors/exit codes)
- `CommandBuilder` wiring with `buildStandardOptions()`
- JSON output when `--json` present

**Step 4: Run test to verify it passes**

Run: `bun test src/features/replay/cli.test.ts`
Expected: PASS.

**Step 5: Commit**

```
git add src/features/replay/cli.ts src/features/replay/cli.test.ts

git commit -m "feat(replay): add show command and docs"
```

---

### Task 6: Dogfooding + docs generation

**Files:**
- Modify: `.nooa/AGENT_MANIFEST.json` (generated)
- Modify: `docs/features/replay.md` (generated)

**Step 1: Dogfood CLI**

```
bun index.ts replay --help
bun index.ts replay add A --json
bun index.ts replay link <idA> <idB> --json
bun index.ts replay fix <idB> "Fix B" --json
bun index.ts replay show --json
```

**Step 2: Generate docs**

```
bun run docs
```

**Step 3: Commit generated docs**

```
git add docs/features/replay.md .nooa/AGENT_MANIFEST.json

git commit -m "docs(replay): add generated feature docs"
```
