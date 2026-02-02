# PR GH Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace GitHub REST API usage in `nooa pr` with GitHub CLI (`gh`) for all PR operations.

**Architecture:** `nooa pr` will execute `gh` commands via `execa`, parse JSON output where available, and keep current CLI UX. `GitHubClient` will be simplified or removed from `pr` flow, and token requirements will be removed from docs in favor of `gh auth login`.

**Tech Stack:** Bun, TypeScript, execa, GitHub CLI.

### Task 1: Add failing tests for GH-backed behavior

**Files:**
- Modify: `src/features/pr/cli.test.ts`

**Step 1: Write the failing test**

```ts
// Add tests that do NOT require GITHUB_TOKEN and assert:
// - pr subcommands use gh (by mocking execa)
// - error message when gh is missing
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/pr/cli.test.ts`
Expected: FAIL until gh-backed implementation exists.

### Task 2: Implement GH-backed PR subcommands

**Files:**
- Modify: `src/features/pr/cli.ts`
- Create: `src/features/pr/gh.ts` (thin wrapper for gh calls)

**Step 1: Write minimal implementation**

```ts
// Implement gh wrappers:
// - gh pr create --title/--body --base --head
// - gh pr list --json
// - gh pr view <num> --json for status (checks, labels, approvals)
// - gh pr merge <num> --merge/--squash/--rebase
// - gh pr close <num>
// - gh pr comment <num> --body
```

**Step 2: Run test to verify it passes**

Run: `bun test src/features/pr/cli.test.ts`
Expected: PASS.

### Task 3: Remove token requirement from pr flow

**Files:**
- Modify: `src/features/pr/cli.ts`
- Modify: `docs/commands/pr.md`
- Modify: `README.md`
- Modify: `.env.example`

**Step 1: Update docs**

```md
- Remove GITHUB_TOKEN requirement for pr
- Add note: requires `gh auth login`
```

**Step 2: Run docs checks**

Run: `rg -n "GITHUB_TOKEN|gh auth" README.md docs/commands/pr.md .env.example`
Expected: Updated content.

### Task 4: Full test run

**Step 1: Run full suite**

Run: `bun test`
Expected: PASS.

### Task 5: Commit

**Step 1: Commit changes**

```bash
git add src/features/pr/cli.ts src/features/pr/cli.test.ts src/features/pr/gh.ts docs/commands/pr.md README.md .env.example
git commit -m "feat: use gh for pr commands"
```
