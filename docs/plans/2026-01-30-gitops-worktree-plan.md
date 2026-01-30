# GitOps Worktree Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**CRITICAL:** Before starting, verify the actual project structure at root level to understand existing patterns for CLI commands, testing, and registry integration.

**Goal:** Add `nooa worktree` to create a git worktree, run setup/tests, and mark a candidate workspace.

**Architecture:** Implement a new `worktree` feature command under `src/features/worktree/`. The command inspects existing worktree directories, ensures `.worktrees/` is ignored, creates a git worktree with a branch, optionally installs deps and runs tests, and logs telemetry.

**Tech Stack:** Bun, TypeScript, execa, git.

**Missing Prerequisites:**
1. How are commands registered in the main CLI? (Check `index.ts` or main CLI router)
2. What's the existing test setup? (Check if there's a test helper or common setup)
3. Is there a telemetry module already? (Reference path needed)
4. What's the error handling pattern? (Check existing commands)
5. Are there shared git utilities? (Avoid duplication)

---

### Task 1: Add CLI help contract for `nooa worktree`

**Files:**
- Create: `src/features/worktree/cli.test.ts`
- Create: `src/features/worktree/cli.ts`

**Step 1: Write the failing test**

```ts
// src/features/worktree/cli.test.ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa worktree", () => {
  it("shows help", async () => {
    const res = await execa("bun", [binPath, "worktree", "--help"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa worktree");
    expect(res.stdout).toContain("--base");
    expect(res.stdout).toContain("--no-test");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/worktree/cli.test.ts`
Expected: FAIL (unknown command).

**ISSUE:** This assumes command discovery works automatically. Need to:
- Check how commands are registered in the main CLI
- Update registry/router to include worktree command

**Step 3: Write minimal implementation**

```ts
// src/features/worktree/cli.ts
const help = `\nUsage: nooa worktree <branch> [flags]\n\nFlags:\n  --base <branch>   Base branch (default: main)\n  --no-install      Skip dependency install\n  --no-test         Skip tests\n  -h, --help        Show help\n`;

const worktreeCommand = {
  name: "worktree",
  execute: async ({ args, values }: any) => {
    if (values.help) {
      console.log(help);
      return;
    }
    console.log(help);
    process.exitCode = 2;
  }
};

export default worktreeCommand;
```

**MISSING:** 
- Integration with main CLI (index.ts or command registry)
- Type definitions for args and values
- Validation for branch name format

**Step 4: Run test to verify it passes**

Run: `bun test src/features/worktree/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/worktree/cli.ts src/features/worktree/cli.test.ts
git commit -m "feat: add worktree help"
```

---

### Task 2: Implement git worktree creation (happy path)

**Files:**
- Modify: `src/features/worktree/cli.ts`
- Create: `src/features/worktree/git.ts`
- Modify: `src/core/registry.test.ts` (if needed for command discovery)
- Modify: `index.ts` or main CLI router (MISSING - critical for command registration)
- Test: `src/features/worktree/cli.test.ts`

**Step 1: Write the failing test**

```ts
// append to src/features/worktree/cli.test.ts
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

**ISSUE:** Missing afterEach cleanup pattern if test fails midway
**ISSUE:** No assertion on worktree actually being created (check .git/worktrees)

it("creates a worktree under .worktrees/<branch>", async () => {
  const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
  await execa("git", ["init"], { cwd: root });
  await writeFile(join(root, ".gitignore"), ".worktrees\n");
  await writeFile(join(root, "README.md"), "hello\n");
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "-m", "init"], { cwd: root });

  const res = await execa("bun", [binPath, "worktree", "feat/test"], {
    cwd: root,
    reject: false,
    env: { ...process.env, NOOA_SKIP_INSTALL: "1", NOOA_SKIP_TEST: "1" }
  });

  expect(res.exitCode).toBe(0);
  // MISSING: Verify worktree was actually created
  expect(existsSync(join(root, ".worktrees", "feat/test"))).toBe(true);
  // MISSING: Verify git worktree list shows the new worktree
  const list = await execa("git", ["worktree", "list"], { cwd: root });
  expect(list.stdout).toContain("feat/test");
  
  await execa("git", ["worktree", "list"], { cwd: root });
  await rm(root, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/worktree/cli.test.ts`
Expected: FAIL (worktree not created).

**Step 3: Write minimal implementation**

```ts
// src/features/worktree/git.ts
import { execa } from "execa";

export async function git(args: string[], cwd: string) {
  return execa("git", args, { cwd, reject: false });
}
```

```ts
// src/features/worktree/cli.ts (add)
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { git } from "./git";

**ISSUES IN THIS CODE BLOCK:**

1. Code runs at module load time (top-level await) - should be inside execute function
2. No error handling for git operations
3. Branch name validation missing (no spaces, special chars, etc)
4. No check if worktree already exists
5. No check if branch name already exists
6. Hardcoded process.cwd() instead of using provided context
7. .gitignore modification has race condition if file doesn't exist
8. No handling for when base branch doesn't exist

const defaultBase = "main";

// WRONG: This code runs at module load, not during command execution!
// detect .worktrees or worktrees; default to .worktrees
const worktreeDir = existsSync(".worktrees") ? ".worktrees" : (existsSync("worktrees") ? "worktrees" : ".worktrees");

// ensure .gitignore has worktreeDir
if (worktreeDir === ".worktrees" && !existsSync(".worktrees")) {
  await mkdir(".worktrees", { recursive: true });
}
if (worktreeDir === "worktrees" && !existsSync("worktrees")) {
  await mkdir("worktrees", { recursive: true });
}
const gi = existsSync(".gitignore") ? await readFile(".gitignore", "utf-8") : "";
if (!gi.includes(worktreeDir)) {
  await writeFile(".gitignore", gi + (gi.endsWith("\n") || gi.length === 0 ? "" : "\n") + `${worktreeDir}\n`);
}

**CORRECTED STRUCTURE NEEDED:**

execute: async ({ args, values }: any) => {
  // Validate inputs
  const branch = args[0];
  if (!branch) throw new Error("Branch name required");
  if (!/^[\\w\\-\\/]+$/.test(branch)) throw new Error("Invalid branch name");
  
  const base = values.base ?? "main";
  const worktreeDir = ".worktrees";
  const worktreePath = join(process.cwd(), worktreeDir, branch);
  
  // Check if worktree exists
  if (existsSync(worktreePath)) throw new Error(`Worktree ${branch} already exists`);
  
  // Ensure directory and .gitignore setup
  // ... (move the setup code here)
  
  // Create worktree with error handling
  const result = await git(["worktree", "add", worktreePath, "-b", branch, base], process.cwd());
  if (result.exitCode !== 0) throw new Error(`Git worktree failed: ${result.stderr}`);
}

const base = values.base ?? defaultBase;
await git(["worktree", "add", join(worktreeDir, branch), "-b", branch, base], process.cwd());
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/worktree/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/worktree/cli.ts src/features/worktree/git.ts src/features/worktree/cli.test.ts
git commit -m "feat: add worktree create"
```

---

### Task 3: Add setup + test runner (flags + env)

**Files:**
- Modify: `src/features/worktree/cli.ts`
- Test: `src/features/worktree/cli.test.ts`

**Step 1: Write the failing test**

```ts
**ISSUE:** Test doesn't verify install/test actually ran
**ISSUE:** No test for when install fails

it("respects --no-install and --no-test", async () => {
  const root = await mkdtemp(join(tmpdir(), "nooa-worktree-"));
  await execa("git", ["init"], { cwd: root });
  await writeFile(join(root, ".gitignore"), ".worktrees\n");
  await writeFile(join(root, "package.json"), "{}\n");
  await writeFile(join(root, "README.md"), "hello\n");
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "-m", "init"], { cwd: root });

  const res = await execa("bun", [binPath, "worktree", "feat/skip", "--no-install", "--no-test"], {
    cwd: root,
    reject: false,
  });

  expect(res.exitCode).toBe(0);
  
  // MISSING: Should test that install/test ACTUALLY run when flags are not set
  // MISSING: Test error handling when install fails
  // MISSING: Test error handling when tests fail
  // MISSING: Test --no-test still installs by default
  await rm(root, { recursive: true, force: true });
});

// MISSING TEST CASES:
// - it("installs deps by default")
// - it("runs tests by default")
// - it("fails gracefully when test suite fails")
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/worktree/cli.test.ts`
Expected: FAIL until flags are honored.

**Step 3: Write minimal implementation**

```ts
const skipInstall = values["no-install"] || process.env.NOOA_SKIP_INSTALL === "1";
const skipTest = values["no-test"] || process.env.NOOA_SKIP_TEST === "1";

if (!skipInstall) {
  if (existsSync(join(worktreePath, "package.json"))) {
    // MISSING: Error handling
    // MISSING: Progress indication
    // MISSING: Check if bun is available, fallback to npm/pnpm/yarn
    await execa("bun", ["install"], { cwd: worktreePath });
  }
}
if (!skipTest) {
  // MISSING: Error handling - should tests failing stop the process?
  // MISSING: What if there's no test script?
  // MISSING: Progress indication
  const testResult = await execa("bun", ["test"], { cwd: worktreePath, reject: false });
  if (testResult.exitCode !== 0) {
    console.error("Tests failed, but worktree was created successfully");
  }
  await execa("bun", ["test"], { cwd: worktreePath });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/worktree/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/worktree/cli.ts src/features/worktree/cli.test.ts
git commit -m "feat: add worktree setup and tests"
```

---

### Task 4: Telemetry + output contract

**Files:**
- Modify: `src/features/worktree/cli.ts`
- Create: `src/features/worktree/execute.test.ts` (optional)

**Step 1: Write the failing test**

```ts
**ISSUE:** No actual test provided, just a comment
**ISSUE:** What telemetry system? Need to reference existing module

// minimal: ensure stderr contains summary and stdout is empty
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/worktree/execute.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Emit telemetry events `worktree.started`, `worktree.success`, `worktree.failure`
  **MISSING:** Import statement for telemetry module
  **MISSING:** Error handling for telemetry failures
  **MISSING:** What data should be captured? (duration, flags used, etc)
  
- Print summary to stderr (worktree path, branch, base, tests run)
  **MISSING:** Actual implementation code
  **MISSING:** Format specification (JSON? Plain text? Colors?)
  
**NEEDED:**
```ts
console.error(`✓ Worktree created: ${worktreePath}`);
console.error(`  Branch: ${branch} (from ${base})`);
console.error(`  Tests: ${skipTest ? 'skipped' : 'passed'}`);
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/worktree/execute.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/worktree/cli.ts src/features/worktree/execute.test.ts
git commit -m "feat: add worktree telemetry"
```

---

### Task 5: Docs

**Files:**
- Create: `docs/commands/worktree.md`

**Step 1: Write doc**

Include usage, flags, exit codes, examples.

**MISSING SECTIONS:**
- Prerequisites (git repo required)
- What is a worktree? (brief explanation)
- Common workflows
- Troubleshooting
- Integration with existing worktrees
- How to remove a worktree
- Environment variables
- Exit codes table

**Step 2: Commit**

```bash
git add docs/commands/worktree.md
git commit -m "docs: add worktree command"
```

---

## MISSING TASKS:

### Task 6: Error handling and edge cases
- Handle case where base branch doesn't exist
- Handle case where worktree already exists
- Handle case where git worktree command fails
- Handle case where not in a git repository

### Task 7: Integration testing
- End-to-end test with real git operations
- Test cleanup on failure

### Task 8: Command registration
- Update main CLI to discover and register worktree command
- Add to command list/help
