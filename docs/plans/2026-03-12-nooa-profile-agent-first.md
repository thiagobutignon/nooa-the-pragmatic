# NOOA Profile Agent-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an agent-first `nooa profile inspect` command that runs a `node` or `bun` command with CPU profiling enabled and returns a compact, structured hotspot summary.

**Architecture:** Implement `profile` as a self-evolving CLI module with one atomic subcommand in V1: `inspect`. The command will inject runtime CPU profiling flags, execute the target command, load the generated `.cpuprofile`, summarize hot functions for agent consumption, and return both machine-readable JSON and a concise human summary. The command is intentionally atomic; no long-lived profiling session is introduced in V1.

**Tech Stack:** Bun, TypeScript, CommandBuilder, V8/Bun CPU profiling flags, Bun test.

---

### Task 1: Scaffold the profile feature contract

**Files:**
- Create: `src/features/profile/cli.ts`
- Create: `src/features/profile/execute.ts`
- Create: `src/features/profile/cli.test.ts`
- Create: `src/features/profile/execute.test.ts`
- Create: `src/features/profile/fixtures/cpu-busy.js`

**Step 1: Write the failing CLI help test**

Assert that `profile --help` documents `inspect`, the `-- <command...>` syntax, and the agent-first hotspot summary.

**Step 2: Run the test to verify it fails**

Run: `bun test src/features/profile/cli.test.ts`
Expected: FAIL because the feature does not exist yet.

**Step 3: Write the failing execution contract test**

Test `run({ action: "inspect", command: ["node", "app.js"] })` and assert that the result shape includes:
- `mode`
- `runtime`
- `exit_code`
- `duration_ms`
- `profile_path`
- `hotspots`

**Step 4: Run the test to verify it fails**

Run: `bun test src/features/profile/execute.test.ts`
Expected: FAIL because the execute module does not exist yet.

**Step 5: Commit**

Do not commit until the feature is green.

### Task 2: Implement atomic CPU profiling execution

**Files:**
- Modify: `src/features/profile/execute.ts`
- Test: `src/features/profile/execute.test.ts`

**Step 1: Implement minimal runtime validation**

Support only `node` and `bun` in V1. Return validation errors for anything else.

**Step 2: Implement profile command preparation**

Inject runtime flags:
- `--cpu-prof`
- `--cpu-prof-dir`
- `--cpu-prof-name`

Build a deterministic profile output directory under `.nooa/profile/`.

**Step 3: Implement target execution**

Spawn the target command, wait for exit, and capture:
- `exit_code`
- `duration_ms`
- `stdout`
- `stderr`

Keep the first implementation direct and boring.

**Step 4: Implement `.cpuprofile` loading**

Read the generated CPU profile JSON after exit. Fail clearly if the file is missing.

**Step 5: Run tests**

Run: `bun test src/features/profile/execute.test.ts`
Expected: PASS

### Task 3: Summarize hotspots for agent consumption

**Files:**
- Modify: `src/features/profile/execute.ts`
- Test: `src/features/profile/execute.test.ts`
- Test: `src/features/profile/fixtures/cpu-busy.js`

**Step 1: Add a failing integration-style test around hotspot ranking**

Use a CPU-heavy fixture and assert the top hotspot references the busy function/script.

**Step 2: Implement profile summarization**

Parse V8 CPU profile nodes and sample/time data into a sorted hotspot list with:
- `function`
- `url`
- `line`
- `self_ms`
- `samples`

Keep the summary compact and deterministic.

**Step 3: Run tests**

Run: `bun test src/features/profile/execute.test.ts`
Expected: PASS

### Task 4: Wire the self-evolving CLI module

**Files:**
- Modify: `src/features/profile/cli.ts`
- Test: `src/features/profile/cli.test.ts`

**Step 1: Implement the `profile inspect` command**

CLI shape:
- `nooa profile inspect -- node script.js`
- `nooa profile inspect -- bun run file.ts`

Use `rawArgs` to split on `--`, matching existing repo patterns like `cron`.

**Step 2: Add self-evolving module exports**

Export:
- `profileAgentDoc`
- `profileFeatureDoc`

Ensure the command is discoverable via dynamic command loading.

**Step 3: Run tests**

Run: `bun test src/features/profile/cli.test.ts src/features/profile/execute.test.ts`
Expected: PASS

### Task 5: Dogfood and verify

**Files:**
- Modify: `src/features/profile/fixtures/cpu-busy.js` if fixture tuning is needed

**Step 1: Dogfood the command**

Run:
`bun run index.ts profile inspect --json -- node src/features/profile/fixtures/cpu-busy.js`

Expected:
- exit code `0`
- `profile_path` exists
- hotspot summary points at the busy fixture

**Step 2: Run targeted verification**

Run:
- `bun test src/features/profile`
- `bun run index.ts profile --help`

**Step 3: Optional broader verification**

Run a focused repo check if the touched files require it.

