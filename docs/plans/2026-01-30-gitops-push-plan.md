# GitOps Push Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `nooa push` wrapper that enforces clean state, optional test, and emits telemetry.

**Architecture:** Implement `push` feature under `src/features/push/`. The command runs preflight checks then calls `git push` (with optional remote/branch). Telemetry logs success/failure.

**Tech Stack:** Bun, TypeScript, execa, git.

### Task 1: Add CLI help contract for `nooa push`

**Files:**
- Create: `src/features/push/cli.test.ts`
- Create: `src/features/push/cli.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa push", () => {
  it("shows help", async () => {
    const res = await execa("bun", [binPath, "push", "--help"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa push [remote] [branch]");
    expect(res.stdout).toContain("Flags:");
    expect(res.stdout).toContain("-h, --help");
    expect(res.stdout).toContain("--no-test");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/push/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/features/push/cli.ts
export function showHelp(): void {
  console.log(`
Usage: nooa push [remote] [branch]

Flags:
  --no-test      Skip running tests before push
  -h, --help     Show this help message
`);
}

export async function handlePushCommand(args: string[]): Promise<void> { /* TBD */ }
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/push/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/push/cli.ts src/features/push/cli.test.ts
git commit -m "feat: add push help"
```

---

### Task 2: Preflight checks

**Files:**
- Create: `src/features/push/guards.ts`
- Modify: `src/features/push/cli.ts`
- Modify: `src/features/push/cli.test.ts`

**Step 1: Write the failing test**

```ts
// create temp repo with uncommitted changes, expect exit 2
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/push/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- `git status --porcelain` must be empty
- run `bun test` unless `--no-test`

```ts
// src/features/push/guards.ts
export async function checkCleanWorkingTree(): Promise<boolean> { /* ... */ }
export async function runTests(): Promise<boolean> { /* ... */ }
```

Exit codes:
- 2: Uncommitted changes detected
- 3: Tests failed

**Step 4: Run test to verify it passes**

Run: `bun test src/features/push/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/push/cli.ts src/features/push/guards.ts src/features/push/cli.test.ts
git commit -m "feat: add push preflight"
```

---

### Task 3: Execute git push + telemetry

**Files:**
- Modify: `src/features/push/cli.ts`
- Modify: `src/features/push/cli.test.ts`

**Step 1: Write the failing test**

```ts
// mock git push via env or fake remote; ensure command invoked
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/push/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- `git push` (with optional remote/branch)
- emit telemetry `push.started`, `push.success`, `push.failure`

Exit codes:
- 0: Success
- 1: Git push failed

Note: Ensure telemetry is emitted even on failure cases.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/push/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/push/cli.ts src/features/push/cli.test.ts
git commit -m "feat: add push execution"
```

---

### Task 4: Docs

**Files:**
- Create or Modify: `docs/commands/push.md`
- Modify: `README.md` (add push to command list if applicable)

**Step 1: Write doc**

Content should include:
- Command syntax: `nooa push [remote] [branch] [--no-test]`
- Description of what the command does
- Preflight checks (clean working tree, tests)
- Flags explanation
- Exit codes (0, 1, 2, 3)
- Examples:
  ```bash
  nooa push                    # push to default remote/branch
  nooa push origin main        # push to specific remote/branch
  nooa push --no-test          # skip tests
  ```
- Troubleshooting common issues

**Step 2: Commit**

```bash
git add docs/commands/push.md README.md
git commit -m "docs: add push command"
```

---

**Post-implementation:** Run full test suite with `bun test` to ensure no regressions.
