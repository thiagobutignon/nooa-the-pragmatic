# NOOA Test Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the test suite pass under `bun run test` after the CLI refactor (nooa v0.0.1) and handle Bun-only DB tests safely.

**Architecture:** Update tests to align with new CLI subcommands and version output. Skip Bun-only DB tests when Bun is unavailable (Vitest/Node). Replace Bun-only file reads in tests with standard fs reads.

**Tech Stack:** Bun, Vitest, Node fs.

---

### Task 1: Fix CLI root test to avoid Bun-only APIs

**Files:**
- Modify: `tests/cli-nooa.test.ts`

**Step 1: Write the failing test**

(Already failing in Vitest: Bun is not defined for package.json read.)

**Step 2: Run test to verify it fails**

Run: `bun run test tests/cli-nooa.test.ts`
Expected: FAIL (Bun is not defined)

**Step 3: Write minimal implementation**

Replace `Bun.file` usage with `node:fs/promises` read and `JSON.parse`.

**Step 4: Run test to verify it passes**

Run: `bun run test tests/cli-nooa.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/cli-nooa.test.ts
git commit -m "test: avoid Bun-only API in cli-nooa test"
```

---

### Task 2: Align main tests with nooa subcommands

**Files:**
- Modify: `tests/main.test.ts`

**Step 1: Write the failing test**

(Existing tests fail due to outdated args and version string.)

**Step 2: Run test to verify it fails**

Run: `bun run test tests/main.test.ts`
Expected: FAIL on version, missing input, bridge/resume behaviors

**Step 3: Write minimal implementation**

- Update args to omit `bun index.ts` (pass CLI args only)
- Use `resume` subcommand for resume-related tests
- Update version expectation to `nooa v0.0.1`
- Keep bridge tests using `bridge` subcommand

**Step 4: Run test to verify it passes**

Run: `bun run test tests/main.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/main.test.ts
git commit -m "test: align main tests with nooa cli"
```

---

### Task 3: Skip DB tests when Bun is unavailable

**Files:**
- Modify: `tests/db.test.ts`

**Step 1: Write the failing test**

(Existing test fails under Vitest: bun:sqlite unavailable.)

**Step 2: Run test to verify it fails**

Run: `bun run test tests/db.test.ts`
Expected: FAIL (Cannot find package 'bun:sqlite')

**Step 3: Write minimal implementation**

Wrap the suite with `describe.skip` when `globalThis.Bun` is undefined.

**Step 4: Run test to verify it passes**

Run: `bun run test tests/db.test.ts`
Expected: PASS (skipped)

**Step 5: Commit**

```bash
git add tests/db.test.ts
git commit -m "test: skip bun-only db tests under vitest"
```

---

### Task 4: Full verification

**Files:**
- None

**Step 1: Run full suite**

Run: `bun run test`
Expected: PASS

**Step 2: Summarize**

Report any remaining failures if they exist.
