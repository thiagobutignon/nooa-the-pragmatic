# Trace, Record, and Bench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `nooa trace`, `nooa record`, and `nooa bench` as agent-first execution evidence commands, starting with local atomic command runs.

**Architecture:** `trace` will define the canonical execution artifact and storage model, `record` will reuse the same collector to persist richer raw output, and `bench` will orchestrate repeated traced runs to compute simple duration stats. All three commands will follow NOOA's `CommandBuilder` and self-describing module patterns.

**Tech Stack:** Bun, TypeScript, NOOA `CommandBuilder`, `execa`, Bun test, NOOA self-evolving module docs.

---

### Task 1: Scaffold the `trace` command contract

**Files:**
- Create: `src/features/trace/cli.ts`
- Test: `src/features/trace/cli.test.ts`
- Modify: `src/core/registry.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `trace` exports a valid command
- `nooa trace --help` shows `inspect`
- missing subcommand returns `trace.missing_subcommand`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/trace/cli.test.ts`

Expected: FAIL because the feature does not exist.

**Step 3: Write minimal implementation**

Create `src/features/trace/cli.ts` with:
- `traceMeta`
- `traceHelp`
- `traceSchema`
- `traceExamples`
- `traceErrors`
- `traceExitCodes`
- minimal `run()` returning help or validation error

**Step 4: Run test to verify it passes**

Run: `bun test src/features/trace/cli.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/trace/cli.ts src/features/trace/cli.test.ts src/core/registry.ts
git commit -m "feat: scaffold trace command"
```

### Task 2: Add `trace` storage and artifact schema

**Files:**
- Create: `src/features/trace/storage.ts`
- Test: `src/features/trace/storage.test.ts`

**Step 1: Write the failing test**

Add tests for:
- default empty load behavior
- saving a trace artifact
- reloading a saved trace artifact
- storing under `.nooa/traces/<traceId>.json`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/trace/storage.test.ts`

Expected: FAIL because storage does not exist.

**Step 3: Write minimal implementation**

Implement:
- `TraceArtifact` type
- `getTracePath(root, traceId)`
- `loadTrace(root, traceId)`
- `saveTrace(root, trace)`

Start with a single-artifact-per-file model.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/trace/storage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/trace/storage.ts src/features/trace/storage.test.ts
git commit -m "feat: add trace artifact storage"
```

### Task 3: Implement atomic `trace inspect`

**Files:**
- Create: `src/features/trace/execute.ts`
- Create: `src/features/trace/fixtures/touch-file.js`
- Test: `src/features/trace/execute.test.ts`
- Modify: `src/features/trace/cli.ts`

**Step 1: Write the failing test**

Add tests that assert:
- successful commands produce a trace with duration and exit code
- failing commands still produce a trace artifact
- stdout/stderr are summarized
- touched files are captured for a simple fixture

**Step 2: Run test to verify it fails**

Run: `bun test src/features/trace/execute.test.ts`

Expected: FAIL because inspect execution is missing.

**Step 3: Write minimal implementation**

Implement `runTrace()` that:
- validates the command
- captures start and end timestamps
- executes the process with `execa(..., { reject: false })`
- computes `durationMs`
- summarizes stdout/stderr
- approximates `filesTouched` using a before/after workspace snapshot
- saves the trace artifact

Keep subprocess collection minimal in V1:
- default empty list or only known direct child metadata if trivially available

**Step 4: Run test to verify it passes**

Run: `bun test src/features/trace/execute.test.ts`

Expected: PASS

**Step 5: Dogfood the command**

Run:
- `bun run index.ts trace --help`
- `bun run index.ts trace inspect -- node src/features/trace/fixtures/touch-file.js`

Expected:
- help renders cleanly
- command writes a trace artifact and prints a compact summary

**Step 6: Commit**

```bash
git add src/features/trace/cli.ts src/features/trace/execute.ts src/features/trace/execute.test.ts src/features/trace/fixtures/touch-file.js
git commit -m "feat: add atomic trace inspect"
```

### Task 4: Scaffold the `record` command contract

**Files:**
- Create: `src/features/record/cli.ts`
- Test: `src/features/record/cli.test.ts`
- Modify: `src/core/registry.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `record` exports a valid command
- `nooa record --help` shows `inspect`
- missing subcommand returns `record.missing_subcommand`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/record/cli.test.ts`

Expected: FAIL because the feature does not exist.

**Step 3: Write minimal implementation**

Create a minimal `record` CLI contract matching the trace style.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/record/cli.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/record/cli.ts src/features/record/cli.test.ts src/core/registry.ts
git commit -m "feat: scaffold record command"
```

### Task 5: Add `record` artifact storage and execution

**Files:**
- Create: `src/features/record/storage.ts`
- Create: `src/features/record/execute.ts`
- Test: `src/features/record/storage.test.ts`
- Test: `src/features/record/execute.test.ts`
- Modify: `src/features/record/cli.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `record inspect` stores stdout and stderr content
- `record inspect` links to a `traceId`
- `record inspect` captures touched files for the simple fixture

**Step 2: Run test to verify it fails**

Run:
- `bun test src/features/record/storage.test.ts`
- `bun test src/features/record/execute.test.ts`

Expected: FAIL because storage and execution are missing.

**Step 3: Write minimal implementation**

Implement:
- `RecordArtifact` type and storage
- `runRecord()` reusing the same execution collector semantics as `trace`
- trace linkage in the saved record

Prefer shared helper extraction only when duplication is real and stable.

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/record/storage.test.ts`
- `bun test src/features/record/execute.test.ts`

Expected: PASS

**Step 5: Dogfood the command**

Run:
- `bun run index.ts record --help`
- `bun run index.ts record inspect -- node src/features/trace/fixtures/touch-file.js`

Expected:
- help renders cleanly
- record artifact contains raw stdout/stderr and links to a trace

**Step 6: Commit**

```bash
git add src/features/record/cli.ts src/features/record/storage.ts src/features/record/execute.ts src/features/record/storage.test.ts src/features/record/execute.test.ts
git commit -m "feat: add atomic record inspect"
```

### Task 6: Scaffold the `bench` command contract

**Files:**
- Create: `src/features/bench/cli.ts`
- Test: `src/features/bench/cli.test.ts`
- Modify: `src/core/registry.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `bench` exports a valid command
- `nooa bench --help` shows `inspect`
- missing subcommand returns `bench.missing_subcommand`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/bench/cli.test.ts`

Expected: FAIL because the feature does not exist.

**Step 3: Write minimal implementation**

Create a minimal `bench` CLI contract matching trace and record.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/bench/cli.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/bench/cli.ts src/features/bench/cli.test.ts src/core/registry.ts
git commit -m "feat: scaffold bench command"
```

### Task 7: Implement atomic `bench inspect`

**Files:**
- Create: `src/features/bench/execute.ts`
- Create: `src/features/bench/storage.ts`
- Test: `src/features/bench/execute.test.ts`
- Test: `src/features/bench/storage.test.ts`
- Modify: `src/features/bench/cli.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `bench inspect` runs a command multiple times
- duration stats include min, median, and max
- success rate is computed correctly
- resulting bench artifact stores related trace ids

**Step 2: Run test to verify it fails**

Run:
- `bun test src/features/bench/execute.test.ts`
- `bun test src/features/bench/storage.test.ts`

Expected: FAIL because bench execution is missing.

**Step 3: Write minimal implementation**

Implement `runBench()` that:
- accepts a command and optional run count
- invokes traced executions repeatedly
- computes duration stats
- stores trace ids and success rate
- saves a bench artifact

Keep V1 duration-only. Do not add CPU or memory metrics yet.

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/bench/execute.test.ts`
- `bun test src/features/bench/storage.test.ts`

Expected: PASS

**Step 5: Dogfood the command**

Run:
- `bun run index.ts bench --help`
- `bun run index.ts bench inspect --runs 3 -- node src/features/trace/fixtures/touch-file.js`

Expected:
- help renders cleanly
- bench summary shows run count, min, median, max, success rate

**Step 6: Commit**

```bash
git add src/features/bench/cli.ts src/features/bench/storage.ts src/features/bench/execute.ts src/features/bench/storage.test.ts src/features/bench/execute.test.ts
git commit -m "feat: add atomic bench inspect"
```

### Task 8: Integrate with replay and generated docs

**Files:**
- Modify: `src/features/replay/storage.ts`
- Modify: `src/features/replay/cli.ts`
- Modify: `README.md`
- Modify: `.agent/skills/telemetry-observability/SKILL.md`
- Modify: `.agent/skills/dogfooding/SKILL.md`
- Create or Modify: `docs/features/trace.md`
- Create or Modify: `docs/features/record.md`
- Create or Modify: `docs/features/bench.md`

**Step 1: Write the failing test**

Add tests that assert replay node rendering can surface trace or record references when present.

**Step 2: Run test to verify it fails**

Run: `bun test src/features/replay/cli.test.ts`

Expected: FAIL because trace/record links are not rendered yet.

**Step 3: Write minimal implementation**

Update replay metadata and rendering so investigations can include:
- trace refs
- record refs
- bench refs where appropriate

Then regenerate docs and update README/skills to teach the new primitives.

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/replay/cli.test.ts`
- `bun run scripts/generate-docs.ts`

Expected: PASS

**Step 5: Final verification**

Run:
- `bun test src/features/trace src/features/record src/features/bench src/features/replay/cli.test.ts`
- `bun run index.ts trace inspect -- node src/features/trace/fixtures/touch-file.js`
- `bun run index.ts record inspect -- node src/features/trace/fixtures/touch-file.js`
- `bun run index.ts bench inspect --runs 3 -- node src/features/trace/fixtures/touch-file.js`

Expected:
- tests pass
- all three commands produce usable artifacts and JSON

**Step 6: Commit**

```bash
git add src/features/replay/storage.ts src/features/replay/cli.ts README.md .agent/skills/telemetry-observability/SKILL.md .agent/skills/dogfooding/SKILL.md docs/features/trace.md docs/features/record.md docs/features/bench.md
git commit -m "docs: integrate trace record and bench into agent workflow"
```
