# Co-locate Tests + Feature-Based Structure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move existing source and test files into a feature-based, vertical-slice structure with co-located tests, without changing logic—only paths/imports/configs.

**Architecture:** Group related files under `src/features/<feature>/` and move each test file alongside its feature implementation as `*.test.ts`. Adjust import paths and test discovery config only.

**Tech Stack:** Bun, TypeScript, Biome.

---

### Task 1: Define target folder map and move files (no logic changes)

**Files:**
- Move: `src/cli/*.ts`, `src/code/*.ts`, `src/bridge.ts`, `src/jobs.ts`, `src/github.ts`, `src/db.ts`, `src/automation.ts`, `src/converter.ts`, `src/json-resume.ts`, `src/matcher.ts`, `src/pdf-generator.ts`, `src/validator.ts`, `src/core/event-bus.ts`
- Move: `tests/*.test.ts`
- Modify: `index.ts` (import paths)

**Step 1: Write the failing test**

Skip (structure-only change; no new behavior). Document that no logic changes are made.

**Step 2: Run test to verify baseline**

Run:
```
bun test
```
Expected: PASS.

**Step 3: Move files into vertical slices**

Proposed structure:

```
src/
  features/
    cli/
      bridge.ts
      jobs.ts
      resume.ts
    code/
      write.ts
      patch.ts
    read/
      read.ts            # NEW location for read logic (extracted from index.ts)
    bridge/
      bridge.ts
    jobs/
      jobs.ts
      github.ts
      db.ts
      automation.ts
    resume/
      converter.ts
      json-resume.ts
      matcher.ts
      pdf-generator.ts
      validator.ts
    core/
      event-bus.ts
```

Tests co-located:

```
src/
  features/
    bridge/
      bridge.test.ts
    code/
      write.test.ts
      patch.test.ts
    read/
      read.test.ts
    resume/
      converter.test.ts
      json-resume.test.ts
      validator.test.ts
      pdf-generator.test.ts
    jobs/
      db.test.ts
      matcher.test.ts
      cli-jobs.test.ts
    cli/
      cli.test.ts
      cli-bridge.test.ts
      cli-resume.test.ts
      cli-nooa.test.ts
      cli-code-write.test.ts
      cli-code-write-patch.test.ts
      cli-read.test.ts
      cli-validate.test.ts
```

Notes:
- **No code rewrites**: only move files and update import paths.
- If `read` logic is still in `index.ts`, do NOT refactor. Keep read logic in `index.ts` and only move its test next to `cli` tests (or `read` if you extract later).

**Step 4: Update imports and index.ts paths**

- Update `index.ts` imports to new paths.
- Update any internal imports between moved modules (relative paths).
- Update tests to import from new locations.

**Step 5: Update test discovery config**

- Ensure `bun test` still finds `*.test.ts` under `src/`.
- If needed, update scripts or config (only if discovery breaks).

**Step 6: Run tests**

```
bun test
```
Expected: PASS.

**Step 7: Commit**

```
git add -A
git commit -m "chore: reorganize src and co-locate tests"
```

---

### Task 2: Adjust tooling/config paths (only if needed)

**Files:**
- Modify: `biome.json`, `tsconfig.json`, `package.json` (only if test discovery or path mapping fails)

**Step 1: Run checks**

```
bun check
bun run linter
```
Expected: PASS.

**Step 2: Fix configs if failing**

- Update include/exclude patterns for `src/**` and `*.test.ts`.
- No logic changes.

**Step 3: Commit**

```
git add -A
git commit -m "chore: update config for co-located tests"
```

---

### Task 3: Final verification

**Step 1: Run full test suite**

```
bun test
```
Expected: PASS.

**Step 2: Run checks and linter**

```
bun check
bun run linter
```
Expected: PASS.

**Step 3: Commit any fixes**

```
git add -A
git commit -m "chore: finalize structure migration"
```

