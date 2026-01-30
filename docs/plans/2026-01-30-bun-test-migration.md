# Bun Test Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the test suite from Vitest to Bun's test runner so `bun test` passes.

**Architecture:** Replace `vitest` imports and `vi.*` usage with `bun:test` equivalents. Use `mock.module` for module mocks and `mock.restore()` between tests. Remove Vitest-only utilities. Keep test behavior identical.

**Tech Stack:** Bun test runner (`bun:test`), Node fs.

---

### Task 1: Migrate cli tests to bun:test

**Files:**
- Modify: `tests/cli-nooa.test.ts`
- Modify: `tests/cli-resume.test.ts`
- Modify: `tests/cli-jobs.test.ts`
- Modify: `tests/cli-bridge.test.ts`

**Step 1: Write the failing test**

Run: `bun test tests/cli-nooa.test.ts`
Expected: FAIL (vitest import/vi usage)

**Step 2: Implement minimal changes**

- Replace `import { describe, expect, test } from "vitest"` with `import { describe, expect, test } from "bun:test"`.
- Remove Vitest-specific helpers.

**Step 3: Verify**

Run: `bun test tests/cli-nooa.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/cli-*.test.ts
git commit -m "test: migrate cli tests to bun:test"
```

---

### Task 2: Migrate core unit tests (non-mocking)

**Files:**
- Modify: `tests/matcher.test.ts`
- Modify: `tests/json-resume.test.ts`

**Step 1: Run one test to see failure**

Run: `bun test tests/matcher.test.ts`
Expected: FAIL (vitest import)

**Step 2: Replace vitest imports**

Use `bun:test` for `describe/it/test/expect`.

**Step 3: Verify**

Run: `bun test tests/matcher.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/matcher.test.ts tests/json-resume.test.ts
git commit -m "test: migrate matcher/json-resume to bun:test"
```

---

### Task 3: Migrate tests with globals + module mocks (validator/bridge/pdf/converter)

**Files:**
- Modify: `tests/validator.test.ts`
- Modify: `tests/bridge.test.ts`
- Modify: `tests/pdf-generator.test.ts`
- Modify: `tests/converter.test.ts`

**Step 1: Replace vitest imports**

Use `import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test"`.

**Step 2: Replace `vi.stubGlobal` / `vi.unstubAllGlobals`**

Use manual stubs:
- Save original in `beforeEach`
- Assign `globalThis.fetch = mock.fn()`
- Restore original in `afterEach`

**Step 3: Replace `vi.mocked`**

Use Bun mocks directly:
- `const fetchMock = globalThis.fetch as ReturnType<typeof mock.fn>`
- `fetchMock.mockResolvedValue(...)`

**Step 4: Replace `vi.hoisted`**

Move mock setup to top-level constants or inside `beforeEach` (Bun doesn’t need hoisting helpers).

**Step 5: Replace `vi.mock(module)` with `mock.module`**

Use:
```
mock.module("../src/bridge", () => ({ ... }))
```

**Step 6: Verify**

Run: `bun test tests/validator.test.ts` and `bun test tests/bridge.test.ts`

**Step 7: Commit**

```bash
git add tests/validator.test.ts tests/bridge.test.ts tests/pdf-generator.test.ts tests/converter.test.ts
git commit -m "test: migrate mock-based tests to bun:test"
```

---

### Task 4: Migrate main CLI integration test to bun:test

**Files:**
- Modify: `tests/main.test.ts`

**Step 1: Replace vitest imports with bun:test**

**Step 2: Replace `vi.mock` with `mock.module`**

**Step 3: Replace spies with `mock.fn` / `mock.spyOn`**

**Step 4: Verify**

Run: `bun test tests/main.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/main.test.ts
git commit -m "test: migrate main to bun:test"
```

---

### Task 5: Remove Vitest dependency and script

**Files:**
- Modify: `package.json`

**Step 1: Update scripts**

- Replace `"test": "vitest"` with `"test": "bun test"`
- Remove Vitest devDependencies

**Step 2: Verify**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: switch test runner to bun"
```

---

### Task 6: Full verification

**Step 1: Run full suite**

Run: `bun test`
Expected: PASS

**Step 2: Summarize**

Report final status.
