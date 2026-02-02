# Worktree command set Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand `nooa worktree` into a subcommand-driven tool that also lists, removes, prunes, locks, and unlocks worktrees while keeping the existing automated creation flow intact.

**Architecture:** The CLI will treat the first argument as either a subcommand or the branch name, dispatching to specific handlers for each action and sharing shared helpers (git validation, telemetry, structured JSON output). Tests will exercise each handler by spinning up temporarygit repos and observing git worktree state. Docs and help text update accordingly.

**Tech Stack:** Bun + TypeScript CLI (existing command framework), `execa` for shelling git/bun, `bun:test` for regression coverage, and markdown docs under `docs/commands`.

### Task 1: Extend worktree CLI to parse subcommands

**Files:**
- Modify: `src/features/worktree/cli.ts`
- Test: `src/features/worktree/cli.test.ts`

**Step 1: Identify command parsing requirements**
```ts
const worktreeActions = new Set(["create","list","remove","prune","lock","unlock"]);
const requested = args[1];
if (!requested) {
    console.log(worktreeHelp);
    process.exitCode = 2;
    return;
}
const isCommand = worktreeActions.has(requested);
const branchOrCommand = isCommand ? args[2] : requested;
```

**Step 2: Add handler scaffolding**
```ts
switch (isCommand ? requested : "create") {
 case "create":
   await handleCreateBranch(...)
   break;
 case "list":
   await handleList(...)
   break;
 ...
}
```
Expect: warning or usage for missing branch when required.

**Step 3: Implement shared helpers**
- Move existing create logic into `handleCreate`.
- Add `runGitWorktreeList`, `runGitCommand` with consistent telemetry payloads.
- Ensure JSON flag triggers `console.log(JSON.stringify(...))` for list + create success.

**Step 4: Run targeted tests**
Command-specific unit tests verifying parsing, help output, feature behavior.
Expect: tests remain failing until implementation done; re-run `bun test src/features/worktree/cli.test.ts`.

**Step 5: Commit**
```
git add src/features/worktree/cli.ts src/features/worktree/cli.test.ts
git commit -m "feat: add worktree subcommands"
```

### Task 2: Expand worktree tests

**Files:**
- Modify: `src/features/worktree/cli.test.ts`

**Step 1: Add tests for list/remove/prune/lock/unlock**
Use `mkdtemp` repos, calling `nooa worktree list` to ensure new entries appear.
Examples: create a worktree, run `list`, expect branch path in output.

**Step 2: Assert remove and lock/unlock behaviors**
Create worktree, lock it, ensure `git worktree list` shows `locked`, then unlock.
Call `nooa worktree remove feat/foo` and verify directory gone.

**Step 3: Test prune runs graciously**
Manual `git worktree prune`, check exit code 0 (use environment to re-run after removing branch) to ensure command resolves.

**Step 4: Run tests and trim output**
```
bun test src/features/worktree/cli.test.ts
```
Expect: relevant assertions passing.

**Step 5: Commit**
```
git add src/features/worktree/cli.test.ts
git commit -m "test: cover worktree subcommands"
```

### Task 3: Update docs and help text

**Files:**
- Modify: `src/features/worktree/cli.ts` (help string)
- Modify: `docs/commands/worktree.md`

**Step 1: Expand help docstring**
Add new subcommand descriptions for `list`, `remove`, `prune`, `lock`, `unlock`, referencing shared flags and `--json` for `list`.

**Step 2: Update Markdown doc**
List each subcommand, describe usage, add examples for removal/pruning/locking/unlocking.

**Step 3: Run `bun check`/`bun lint`**
```
bun check src/features/worktree/cli.ts docs/commands/worktree.md
bun lint
```
Expect: zero type/lint errors.

**Step 4: Commit**
```
git add src/features/worktree/cli.ts docs/commands/worktree.md
git commit -m "docs: describe worktree subcommands"
```

### Task 4: Final verification and cleanup

**Files:**
- Test: entire suite for regression coverage

**Step 1: Run full suite in worktree**
```
bun test
```
Ensure passes.

**Step 2: Run linters/checks**
```
bun check
bun lint
```
All should succeed.

**Step 3: Record plan completion**
None (plan already saved).

**Step 4: Push worktree branch**
```
git push -u origin <topic-branch>
```

### Task 5: Summarize & next steps
- Document new commands in `docs/commands/worktree.md` and the CLI help string. Ensure JSON output is explained.
- Confirm `nooa worktree` now behaves as requested in the plan.
