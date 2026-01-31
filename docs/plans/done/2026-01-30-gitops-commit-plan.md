# GitOps Commit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `nooa commit` wrapper with guardrails (no TODO/MOCK in prod, tests green) and telemetry.

**Architecture:** Implement `commit` feature under `src/features/commit/`. The command runs a preflight: status clean check, forbidden markers scan, optional test run, and then executes `git commit -m`. It emits telemetry events.

**Tech Stack:** Bun, TypeScript, execa, ripgrep (if available).

**Implementation Notes (from worktree execution):**
- In CLI tests, resolve `binPath` via `fileURLToPath(new URL("../../../index.ts", import.meta.url))` so tests work when `cwd` changes.
- Temp git repos in tests must set user.name/user.email for commits.
- If tests create a repo, rename default branch to `main` for consistency.
- Avoid assuming stdin is open; Bun coverage can close stdin (`Premature close`). When reading stdin, guard with try/catch and treat as empty.

### Task 1: Add CLI help contract for `nooa commit`

**Files:**
- Create: `src/features/commit/cli.test.ts`
- Create: `src/features/commit/cli.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa commit", () => {
  it("shows help", async () => {
    const res = await execa("bun", [binPath, "commit", "--help"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa commit -m");
    expect(res.stdout).toContain("--no-test");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/commit/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
const help = `\nUsage: nooa commit -m <message> [flags]\n\nFlags:\n  --no-test      Skip tests\n  --allow-todo   Allow TODO/MOCK markers\n  -h, --help     Show help\n`;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/commit/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/commit/cli.ts src/features/commit/cli.test.ts
git commit -m "feat: add commit help"
```

---

### Task 2: Implement guardrails (scan + status)

**Files:**
- Create: `src/features/commit/guards.ts`
- Modify: `src/features/commit/cli.ts`
- Test: `src/features/commit/cli.test.ts`

**Step 1: Write the failing test**

```ts
// create temp repo, set user.name/user.email, rename branch to main
// add a file with TODO, expect exit code 2 and message
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/commit/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- `git status --porcelain` must be non-empty
- scan tracked files for `TODO:`, `MOCK:`, `Implement this later` (use rg if available, fallback to simple read)
- if violations, print error and exit 2

**Step 4: Run test to verify it passes**

Run: `bun test src/features/commit/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/commit/cli.ts src/features/commit/guards.ts src/features/commit/cli.test.ts
git commit -m "feat: add commit guardrails"
```

---

### Task 3: Implement commit execution + telemetry

**Files:**
- Modify: `src/features/commit/cli.ts`
- Test: `src/features/commit/cli.test.ts`

**Step 1: Write the failing test**

```ts
// commit succeeds on clean repo with staged changes
// ensure repo has user.name/user.email configured for git commit
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/commit/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- run `bun test` unless `--no-test`
- `git commit -m <message>`
- emit telemetry `commit.started`, `commit.success`, `commit.failure`

**Step 4: Run test to verify it passes**

Run: `bun test src/features/commit/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/commit/cli.ts src/features/commit/cli.test.ts
git commit -m "feat: add commit execution"
```

---

### Task 4: Docs

**Files:**
- Create: `docs/commands/commit.md`

**Step 1: Write doc**

Usage, flags, guardrails list, exit codes, examples.

**Step 2: Commit**

```bash
git add docs/commands/commit.md
git commit -m "docs: add commit command"
```
