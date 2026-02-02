# PR Subcommands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `merge`, `close`, `comment`, and `status` subcommands to `nooa pr`, update CLI help and `docs/commands/pr.md`.

**Architecture:** Extend `src/features/pr/cli.ts` to route new subcommands and add GitHub client methods (or REST calls) to perform merge/close/comment/status. Keep JSON/TTY output consistent with existing `pr` commands and ensure required inputs are validated.

**Tech Stack:** Bun, TypeScript, GitHub REST API via existing `GitHubClient`, Bun test.

### Task 1: Add failing tests for new subcommands

**Files:**
- Modify: `src/features/pr/cli.test.ts`

**Step 1: Write the failing test**

```ts
// Add tests for merge/close/comment/status help + JSON error handling
// Example assertions (to adjust in implementation):
// - merge requires PR number and merge method (merge/squash/rebase)
// - close requires PR number
// - comment requires PR number and markdown body (stdin or flag)
// - status returns checks/labels/approvals in JSON
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/pr/cli.test.ts`
Expected: FAIL with missing subcommand behavior / validation errors.

### Task 2: Add GitHub client support for PR merge/close/comment/status

**Files:**
- Modify: `src/core/integrations/github.ts`
- Modify: `src/core/integrations/github.test.ts`

**Step 1: Write the failing test**

```ts
// Add tests that the client exposes mergePR/closePR/commentPR/getPRStatus
// Keep tests structure consistent with existing GitHubClient tests.
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/integrations/github.test.ts`
Expected: FAIL with missing methods.

**Step 3: Write minimal implementation**

```ts
// Implement client methods to call GitHub API endpoints:
// - Merge: PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
// - Close: PATCH /repos/{owner}/{repo}/pulls/{pull_number} with state: closed
// - Comment: POST /repos/{owner}/{repo}/issues/{issue_number}/comments
// - Status: combine PR details + reviews + checks + labels (see Task 3 usage)
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/integrations/github.test.ts`
Expected: PASS.

### Task 3: Implement subcommand behavior in `pr` CLI

**Files:**
- Modify: `src/features/pr/cli.ts`
- Modify: `src/features/pr/cli.test.ts`

**Step 1: Write minimal implementation**

```ts
// Add subcommands:
// - merge <number> --method <merge|squash|rebase> [--title/--message]
// - close <number>
// - comment <number> --body <markdown> (or stdin if body missing)
// - status <number> (returns checks, labels, approvals)
// Ensure JSON output includes ok + result payload; TTY shows human summary.
```

**Step 2: Run test to verify it passes**

Run: `bun test src/features/pr/cli.test.ts`
Expected: PASS.

### Task 4: Update help and docs

**Files:**
- Modify: `src/features/pr/cli.ts` (help string)
- Modify: `docs/commands/pr.md`

**Step 1: Write docs updates**

```md
# `pr`
- Document create/list/review/merge/close/comment/status
- Include flags for merge method and comment markdown
- Describe status output (checks, labels, approvals)
```

**Step 2: Verify docs references**

Run: `rg -n "pr" docs/commands/pr.md`
Expected: Updated sections present.

### Task 5: Full test run

**Step 1: Run full suite**

Run: `bun test`
Expected: PASS.

### Task 6: Commit

**Step 1: Commit changes**

```bash
git add src/core/integrations/github.ts src/core/integrations/github.test.ts src/features/pr/cli.ts src/features/pr/cli.test.ts docs/commands/pr.md
git commit -m "feat: add pr merge close comment status"
```
