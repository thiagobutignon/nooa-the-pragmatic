# NOOA SDK (All Commands) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a full programmatic SDK that covers every CLI command/subcommand, with typed results, documentation under `docs/sdk/`, tests, and dogfooding. The CLI should delegate to SDK where possible.

**Architecture:**
- Keep the SDK **inside the NOOA repo** in `src/sdk/`, aligned with the existing `src/features/<command>` structure.
- Each SDK module wraps existing `execute.ts`/`engine.ts` for that command (never call the CLI from the SDK).
- CLI becomes a thin adapter on top of SDK, preserving output behavior.
- Add per-command SDK docs (`docs/sdk/<command>.md`) mirroring CLI capabilities and typed returns.

**Tech Stack:** Bun test, TypeScript, existing feature modules, Zod where schemas already exist.

---

## Phase 0: SDK Core + Inventory

### Task 0.1: Create SDK skeleton & base types

**Files:**
- Create: `src/sdk/index.ts`
- Create: `src/sdk/types.ts`
- Create: `src/sdk/errors.ts`
- Create: `docs/sdk/README.md`
- Create: `src/sdk/index.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("SDK surface", () => {
  it("exposes all commands", () => {
    const expected = [
      "ai","ask","check","ci","code","commit","context","cron",
      "doctor","embed","eval","fix","goal","guardrail","ignore","index",
      "init","mcp","message","pr","prompt","push","read","review",
      "run","scaffold","search","skills","worktree"
    ];
    for (const cmd of expected) {
      expect((sdk as Record<string, unknown>)[cmd]).toBeDefined();
    }
  });
});
```

**Step 2: Run test to verify it fails**
Run: `bun test src/sdk/index.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Add `sdk` object with placeholders.
- `SdkResult<T>`, `SdkError`, `SdkWarning` in `src/sdk/types.ts`.

**Step 4: Run test to verify it passes**
Run: `bun test src/sdk/index.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/sdk docs/sdk src/sdk/index.test.ts
git commit -m "feat(sdk): add core sdk surface and types"
```

---

## Phase 1: Command-by-Command SDK Modules

> For each command, create:
> - `src/sdk/<command>.ts` (exports SDK methods)
> - `src/sdk/<command>.test.ts` (unit tests)
> - `docs/sdk/<command>.md` (docs)
> - Update `src/sdk/index.ts` to export it
>
> All SDK methods should be thin wrappers of existing `src/features/<command>/*` logic.

### Task 1: `ai` SDK

**Files:**
- Create: `src/sdk/ai.ts`
- Create: `src/sdk/ai.test.ts`
- Create: `docs/sdk/ai.md`
- Modify: `src/sdk/index.ts`

**Step 1: Write failing test**
```ts
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("sdk.ai", () => {
  it("runs and returns structured output", async () => {
    const result = await sdk.ai.run({ prompt: "hello", json: true });
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

**Step 2: Run test (fail)**
Run: `bun test src/sdk/ai.test.ts`
Expected: FAIL.

**Step 3: Implement**
Wrap `src/features/ai/execute.ts` and normalize output.

**Step 4: Run test (pass)**
Run: `bun test src/sdk/ai.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/sdk/ai.ts src/sdk/ai.test.ts docs/sdk/ai.md src/sdk/index.ts
git commit -m "feat(sdk): add ai sdk"
```

---

### Task 2: `ask` SDK

(Repeat structure for every command listed below.)

---

### Commands to implement (one task each):
- `ask`
- `check`
- `ci`
- `code`
- `commit`
- `context`
- `cron`
- `doctor`
- `embed`
- `eval`
- `fix`
- `goal`
- `guardrail`
- `ignore`
- `index`
- `init`
- `mcp`
- `message`
- `pr`
- `prompt`
- `push`
- `read`
- `review`
- `run`
- `scaffold`
- `search`
- `skills`
- `worktree`

---

## Phase 2: CLI Delegation

### Task 30: CLI delegates to SDK

**Files:**
- Modify: each `src/features/<command>/cli.ts`

**Steps:**
1) Add tests verifying CLI JSON output equals SDK JSON output.
2) Implement CLI -> SDK call.
3) Run tests.
4) Commit.

---

## Phase 3: Docs

### Task 31: SDK docs index

**Files:**
- Modify: `docs/sdk/README.md`

**Steps:**
1) Add quick usage and links to each `docs/sdk/<command>.md`.
2) Commit.

---

## Phase 4: Dogfooding & Verification

### Task 32: SDK dogfooding

**Files:**
- Create: `scripts/sdk-dogfood.ts`

**Steps:**
1) Call 5–8 SDK commands (including guardrail/check/read/search).
2) Print summary.
3) Run it manually and keep script.
4) Commit.

### Task 33: Verification

Run:
- `bun test`
- `bun check`
- `nooa guardrail check --spec`
- `bun test --coverage`

---

## Phase 5: Versioning

### Task 34: SDK versioning

**Steps:**
1) Add `sdkVersion` export in `src/sdk/index.ts` (same as `package.json`).
2) Update `README.md` and `docs/sdk/README.md` with SDK version policy.
3) Tag release `vX.Y.Z`.

---

## Deliverables

- Full SDK in `src/sdk/` for every CLI command.
- SDK docs in `docs/sdk/` for each command.
- CLI delegates to SDK.
- Dogfooding script + evidence.
- All tests/checks pass.

