# NOOA Debug Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native `nooa debug` command family with real breakpoint-driven debugging for Node.js and Bun.

**Architecture:** The feature will expose a `CommandBuilder`-based CLI in `src/features/debug/cli.ts` backed by persistent named debug sessions and runtime adapters. Delivery starts with session lifecycle and Node inspector support, then layers inspection, breakpoints, execution control, expression evaluation, and Bun support.

**Tech Stack:** Bun, TypeScript, NOOA `CommandBuilder`, Node/Bun inspector protocols, Bun test.

---

### Task 1: Scaffold the debug feature contract

**Files:**
- Create: `src/features/debug/cli.ts`
- Create: `src/features/debug/contracts.ts`
- Test: `src/features/debug/cli.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `debug` exports a valid command
- `nooa debug --help` shows the planned subcommands
- missing subcommand returns `debug.missing_subcommand`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/cli.test.ts`

Expected: FAIL because the feature does not exist.

**Step 3: Write minimal implementation**

Create a minimal `debug` feature that:
- registers the command
- returns help when requested
- returns a validation error when no subcommand is provided

**Step 4: Run test to verify it passes**

Run: `bun test src/features/debug/cli.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/cli.ts src/features/debug/contracts.ts src/features/debug/cli.test.ts
git commit -m "feat: scaffold debug command"
```

### Task 2: Add a session store and lifecycle primitives

**Files:**
- Create: `src/features/debug/session/store.ts`
- Create: `src/features/debug/session/types.ts`
- Test: `src/features/debug/session/store.test.ts`

**Step 1: Write the failing test**

Add tests for:
- creating a named session record
- loading an existing session
- updating state from `idle` to `running` to `paused`
- clearing a session

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/session/store.test.ts`

Expected: FAIL because the store does not exist.

**Step 3: Write minimal implementation**

Implement a session store that manages:
- session id/name
- runtime kind
- target process metadata
- current state
- pause snapshot metadata

Start with file-backed or in-memory storage as needed for tests, but keep the interface suitable for real CLI reuse.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/debug/session/store.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/session/store.ts src/features/debug/session/types.ts src/features/debug/session/store.test.ts
git commit -m "feat: add debug session store"
```

### Task 3: Add runtime adapter interfaces and a fake adapter

**Files:**
- Create: `src/features/debug/adapters/types.ts`
- Create: `src/features/debug/adapters/fake.ts`
- Test: `src/features/debug/adapters/fake.test.ts`

**Step 1: Write the failing test**

Add tests that define the adapter contract for:
- launch
- attach
- status
- stop
- state inspection
- breakpoints
- continue / step
- eval

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/adapters/fake.test.ts`

Expected: FAIL because the adapters are missing.

**Step 3: Write minimal implementation**

Define a shared interface so the command layer can remain runtime-agnostic.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/debug/adapters/fake.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/types.ts src/features/debug/adapters/fake.ts src/features/debug/adapters/fake.test.ts
git commit -m "feat: define debug adapter contract"
```

### Task 4: Implement Node launch, status, and stop

**Files:**
- Create: `src/features/debug/adapters/node.ts`
- Create: `src/features/debug/execute.ts`
- Modify: `src/features/debug/cli.ts`
- Test: `src/features/debug/execute.test.ts`
- Test: `src/features/debug/node.integration.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `debug launch --brk node <fixture>`
- `debug status`
- `debug stop`

Use a simple Node fixture that pauses on start.

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/execute.test.ts`

Expected: FAIL because launch/status/stop are unimplemented.

**Step 3: Write minimal implementation**

Implement:
- Node runtime detection
- process spawn with inspector
- session creation and persistence
- status query
- stop cleanup

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/debug/execute.test.ts`
- `bun test src/features/debug/node.integration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/node.ts src/features/debug/execute.ts src/features/debug/cli.ts src/features/debug/execute.test.ts src/features/debug/node.integration.test.ts
git commit -m "feat: add debug launch status and stop"
```

### Task 5: Implement paused state inspection

**Files:**
- Modify: `src/features/debug/adapters/node.ts`
- Create: `src/features/debug/refs.ts`
- Modify: `src/features/debug/execute.ts`
- Test: `src/features/debug/state.test.ts`
- Test: `src/features/debug/refs.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `debug state` returns source, locals, and stack when paused
- `debug vars` returns local variables
- `debug stack` returns frames
- refs like `@v1` and `@f0` are assigned deterministically

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/state.test.ts`

Expected: FAIL because inspection is missing.

**Step 3: Write minimal implementation**

Implement:
- pause snapshot retrieval
- source excerpt rendering
- variable and frame extraction
- per-session ref bookkeeping

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/debug/state.test.ts`
- `bun test src/features/debug/refs.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/node.ts src/features/debug/refs.ts src/features/debug/execute.ts src/features/debug/state.test.ts src/features/debug/refs.test.ts
git commit -m "feat: add debug state inspection"
```

### Task 6: Implement breakpoints

**Files:**
- Modify: `src/features/debug/adapters/node.ts`
- Modify: `src/features/debug/execute.ts`
- Test: `src/features/debug/breakpoints.test.ts`
- Test: `src/features/debug/breakpoints.integration.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `debug break <file>:<line>`
- `debug break-ls`
- `debug break-rm`
- breakpoint refs like `BP#1`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/breakpoints.test.ts`

Expected: FAIL because breakpoint commands are missing.

**Step 3: Write minimal implementation**

Implement breakpoint create/list/remove against the Node adapter and store refs in session state.

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/debug/breakpoints.test.ts`
- `bun test src/features/debug/breakpoints.integration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/node.ts src/features/debug/execute.ts src/features/debug/breakpoints.test.ts src/features/debug/breakpoints.integration.test.ts
git commit -m "feat: add debug breakpoints"
```

### Task 7: Implement execution control

**Files:**
- Modify: `src/features/debug/adapters/node.ts`
- Modify: `src/features/debug/execute.ts`
- Test: `src/features/debug/execution.integration.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `debug continue`
- `debug step over`
- `debug step into`
- `debug step out`

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/execution.integration.test.ts`

Expected: FAIL because control commands are unimplemented.

**Step 3: Write minimal implementation**

Implement continue and stepping, including pause-state refresh and ref invalidation on resume.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/debug/execution.integration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/node.ts src/features/debug/execute.ts src/features/debug/execution.integration.test.ts
git commit -m "feat: add debug execution control"
```

### Task 8: Implement expression evaluation

**Files:**
- Modify: `src/features/debug/adapters/node.ts`
- Modify: `src/features/debug/execute.ts`
- Test: `src/features/debug/eval.integration.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `debug eval "typeof foo"`
- eval in the current paused frame
- validation when no paused session exists

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/eval.integration.test.ts`

Expected: FAIL because eval is missing.

**Step 3: Write minimal implementation**

Implement frame-aware evaluation and compact result formatting.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/debug/eval.integration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/node.ts src/features/debug/execute.ts src/features/debug/eval.integration.test.ts
git commit -m "feat: add debug eval"
```

### Task 9: Add Bun runtime support

**Files:**
- Create: `src/features/debug/adapters/bun.ts`
- Modify: `src/features/debug/execute.ts`
- Test: `src/features/debug/bun.integration.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `debug launch --brk bun <fixture>`
- state inspection against Bun runtime
- breakpoint hit against Bun runtime

**Step 2: Run test to verify it fails**

Run: `bun test src/features/debug/bun.integration.test.ts`

Expected: FAIL because Bun adapter is missing.

**Step 3: Write minimal implementation**

Implement Bun adapter support using the same session and command flow.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/debug/bun.integration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/debug/adapters/bun.ts src/features/debug/execute.ts src/features/debug/bun.integration.test.ts
git commit -m "feat: add bun debug runtime"
```

### Task 10: Dogfood the command and document it

**Files:**
- Modify: `README.md`
- Create: `docs/features/debug.md` if generated workflow requires explicit output
- Modify: `scripts/generate-docs.ts` only if needed
- Test: `index.nooa.test.ts` or feature cohesion tests as appropriate

**Step 1: Write the failing test**

Add or update tests asserting:
- `nooa --help` lists `debug`
- `nooa debug --help` shows the expected subcommands
- JSON output remains stdout-clean and deterministic

**Step 2: Run test to verify it fails**

Run:
- `bun test index.nooa.test.ts`
- `bun test src/features/debug/cli.test.ts`

Expected: FAIL until docs/help are wired correctly.

**Step 3: Write minimal implementation**

Update user-facing docs and ensure generated help/docs align with the command contract.

**Step 4: Run test to verify it passes**

Run:
- `bun test src/features/debug`
- `bun test index.nooa.test.ts`
- `bun run index.ts debug --help`
- `bun run docs`

Expected: PASS

**Step 5: Commit**

```bash
git add README.md src/features/debug docs/features/debug.md scripts/generate-docs.ts index.nooa.test.ts
git commit -m "docs: add nooa debug command"
```

### Task 11: Final verification gate

**Files:**
- No new files expected

**Step 1: Run targeted verification**

Run:
- `bun test src/features/debug`
- `bun run index.ts debug --help`
- `bun run index.ts debug launch --brk node src/features/debug/fixtures/simple-app.js`
- `bun run index.ts debug state`
- `bun run index.ts debug stop`

Expected: PASS

**Step 2: Run repository-level verification relevant to touched surfaces**

Run:
- `bun test index.nooa.test.ts`
- `bun run check`

Expected: PASS, except for any known unrelated baseline issue already acknowledged outside this feature.

**Step 3: Commit final polish**

```bash
git add -A
git commit -m "feat: add nooa debug v1"
```
