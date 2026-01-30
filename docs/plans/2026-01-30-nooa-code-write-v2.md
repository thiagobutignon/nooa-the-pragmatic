# NOOA Code Write v2 (Patch Mode) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add patch mode to `nooa code write` to apply diffs to existing files safely.

**Architecture:** CLI accepts `--patch` input (unified diff) and applies it to a target file using a patch engine. Validate context, detect conflicts, and return structured output. For v2, use a small patch library or implement a minimal unified-diff applier for single-file patches.

**Tech Stack:** Bun, TypeScript, execa, node:fs/promises, Biome.

---

### Task 1: Define patch mode CLI contract

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-code-write-patch.test.ts`

**Step 1: Write the failing test**

Create `tests/cli-code-write-patch.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[], input?: string) =>
  execa("bun", ["index.ts", ...args], { reject: false, input });

describe("nooa code write --patch", () => {
  test("--help includes patch flags", async () => {
    const res = await run(["code", "write", "--help"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("--patch");
    expect(res.stdout).toContain("--patch-from");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-code-write-patch.test.ts
```
Expected: FAIL (help missing flags).

**Step 3: Write minimal implementation**

Update `index.ts` help text to include `--patch` and `--patch-from <file>` and brief semantics.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-code-write-patch.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-code-write-patch.test.ts
git commit -m "feat: add patch flags to help"
```

---

### Task 2: Introduce patch applier module

**Files:**
- Create: `src/code/patch.ts`
- Test: `tests/code-patch.test.ts`

**Step 1: Write the failing test**

Create `tests/code-patch.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { applyPatch } from "../src/code/patch";

const original = "line1\nline2\nline3\n";
const patch = `--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2-updated\n line3\n`;

describe("applyPatch", () => {
  test("applies unified diff", () => {
    const result = applyPatch(original, patch);
    expect(result).toBe("line1\nline2-updated\nline3\n");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/code-patch.test.ts
```
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `src/code/patch.ts` with a minimal unified diff applier that handles single-file patches and single hunks. If you prefer a small library, add dependency and wrap it (document why).

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/code-patch.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add src/code/patch.ts tests/code-patch.test.ts
git commit -m "feat: add patch applier"
```

---

### Task 3: Wire patch mode into CLI

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-code-write-patch.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-code-write-patch.test.ts`:

```ts
import { readFile, writeFile, rm } from "node:fs/promises";

const OUT = "tmp-patch.txt";

afterEach(async () => {
  await rm(OUT, { force: true });
});

test("applies patch from stdin", async () => {
  await writeFile(OUT, "line1\nline2\nline3\n");
  const patch = `--- a/tmp-patch.txt\n+++ b/tmp-patch.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2-updated\n line3\n`;
  const res = await run(["code", "write", OUT, "--patch"], patch);
  expect(res.exitCode).toBe(0);
  const text = await readFile(OUT, "utf-8");
  expect(text).toBe("line1\nline2-updated\nline3\n");
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-code-write-patch.test.ts
```
Expected: FAIL (patch mode not implemented).

**Step 3: Write minimal implementation**

In `index.ts`:
- If `--patch` is set, read patch from stdin (or `--patch-from`) instead of normal content
- Read file content, apply patch via `applyPatch`
- Write back if success; on conflict, exit code 1 with error message

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-code-write-patch.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-code-write-patch.test.ts src/code/patch.ts
git commit -m "feat: support patch mode for code write"
```

---

### Task 4: Gates

**Step 1: Run full tests**

```
bun test
```
Expected: PASS.

**Step 2: Run checks**

```
bun check
```
Expected: PASS.

**Step 3: Run linter**

```
bun run linter
```
Expected: PASS.

**Step 4: Commit any fixes**

```
git add -A
git commit -m "chore: finalize code write patch"
```

