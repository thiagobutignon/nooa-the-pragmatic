# Ralph Loop Implementation Plan

> **For agents in this repo:** use project-local skills from `.agent/skills/` and follow `docs/reference/ai-assisted-development-workflow.md` while executing this plan.

**Goal:** Implement an MVP of `nooa ralph` that supports Ralph-style fresh-iteration story execution with mandatory peer review by another AI, up to 3 review rounds, and reuse of NOOA's existing worktree, goal, workflow, ci, review, and replay subsystems.

**Architecture:** The MVP will introduce a new `src/features/ralph/` slice with three layers. `state/prd/progress` manage persistent run state under `.nooa/ralph/`. `execute.ts` orchestrates `init`, `status`, `step`, and `run`. `cli.ts` exposes the user-facing command via the existing self-evolving command builder pattern. The first worker engine will delegate implementation to `act`, while peer review will delegate to `review` plus explicit reviewer round state.

**Tech Stack:** Bun, TypeScript, NOOA command-builder, worktree subsystem, workflow engine, ci/check/review commands, replay storage, local docs/plans workflow.

---

### Task 1: Add Ralph state primitives

**Files:**
- Create: `src/features/ralph/state.ts`
- Create: `src/features/ralph/prd.ts`
- Create: `src/features/ralph/progress.ts`
- Test: `src/features/ralph/state.test.ts`

**Step 1: Write the failing state tests**

Cover:
- initialize `.nooa/ralph/state.json`
- load/save Ralph-compatible `prd.json`
- track story states (`pending`, `implementing`, `peer_review_1`, `approved`, `blocked`, `passed`)
- append progress entries
- persist worker/reviewer config separately
- persist timeout settings
- acquire/release mutation lock for writers
- reject concurrent mutation attempts cleanly

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/state.test.ts
```

Expected:
- module/file not found or missing functions

**Step 3: Implement minimal state layer**

Implement:
- state file path helpers
- PRD load/save helpers
- story selection helpers
- progress append helpers
- worker/reviewer config fields
- timeout fields
- lock helpers with atomic file-based acquisition

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/state.test.ts
```

Expected:
- pass

**Step 5: Commit**

```bash
git add src/features/ralph/state.ts src/features/ralph/prd.ts src/features/ralph/progress.ts src/features/ralph/state.test.ts
git commit -m "feat(ralph): add persistent loop state primitives"
```

### Task 2: Add Ralph command contract and status/init flows

**Files:**
- Create: `src/features/ralph/cli.ts`
- Create: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/cli.test.ts`
- Test: `src/features/ralph/execute.test.ts`

**Step 1: Write failing tests for `init` and `status`**

Cover:
- `nooa ralph --help`
- `nooa ralph init`
- `nooa ralph status --json`
- status with missing run state
- `init` verifies `.nooa/ralph/` git-ignore safety before writing state

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/cli.test.ts src/features/ralph/execute.test.ts
```

Expected:
- missing command / missing exports

**Step 3: Implement minimal command surface**

Subcommands:
- `init`
- `status`
- `import-prd`
- `select-story`

Minimal behavior:
- initialize `.nooa/ralph/`
- import or create PRD file
- return structured status payload
- store worker/reviewer provider/model config
- refuse unsafe init if `.nooa/ralph/` would be tracked
- expose story selection as a standalone CLI path
- initialize lock conventions without leaving stale locks behind

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/cli.test.ts src/features/ralph/execute.test.ts
```

Expected:
- pass

**Step 5: Dogfood the CLI**

Run:

```bash
bun run index.ts ralph --help
bun run index.ts ralph status --json
```

Expected:
- command is listed
- help is accurate
- status returns valid JSON or a clear no-run state

**Step 6: Commit**

```bash
git add src/features/ralph/cli.ts src/features/ralph/execute.ts src/features/ralph/cli.test.ts src/features/ralph/execute.test.ts
git commit -m "feat(ralph): add init and status flows"
```

### Task 3: Implement story state machine with review rounds

**Files:**
- Modify: `src/features/ralph/state.ts`
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/state-machine.test.ts`

**Step 1: Write failing tests for review state transitions**

Cover:
- `pending -> implementing`
- `verifying -> peer_review_1`
- reviewer requests changes -> `peer_fix_1`
- second and third review rounds
- third failure -> `blocked`
- approval required before `passed`

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/state-machine.test.ts
```

Expected:
- missing transitions / invalid state handling

**Step 3: Implement transition helpers**

Keep transitions explicit and deterministic:
- one helper for allowed next states
- one helper to record reviewer metadata
- one helper to mark approval
- one helper to reject same worker/reviewer identity when strict mode is enabled

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/state-machine.test.ts
```

Expected:
- pass

**Step 5: Commit**

```bash
git add src/features/ralph/state.ts src/features/ralph/execute.ts src/features/ralph/state-machine.test.ts
git commit -m "feat(ralph): add peer review state machine"
```

### Task 4: Implement `ralph step` with fresh worker execution

**Files:**
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/step.test.ts`

**Step 1: Write failing tests for single-story step execution**

Cover:
- selects highest-priority pending story
- sets current goal
- delegates implementation to `act`
- runs verification before review
- persists progress and state updates
- executes worker in strict headless mode
- fails cleanly on worker timeout

Use injected adapters/mocks for:
- act worker
- workflow/ci/review commands
- commit writer
- timeout/process runner

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/step.test.ts
```

Expected:
- `step` not implemented or incomplete

**Step 3: Implement minimal `step` orchestration**

Order:
- load run state
- select story
- set goal
- invoke implementation worker in headless mode
- run `workflow`
- run `ci`
- move into peer review state

Do **not** mark story passed yet unless review explicitly approves.

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/step.test.ts
```

Expected:
- pass

**Step 5: Dogfood the CLI**

Run:

```bash
bun run index.ts ralph step --json
```

Expected:
- clear "no active run" or "story executed" structured output

**Step 6: Commit**

```bash
git add src/features/ralph/execute.ts src/features/ralph/step.test.ts
git commit -m "feat(ralph): add single-story execution step"
```

### Task 5: Implement mandatory peer review loop

**Files:**
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/review-loop.test.ts`

**Step 1: Write failing tests for review behavior**

Cover:
- story cannot self-approve
- reviewer findings force correction round
- approval on round 1, 2, or 3 works
- rejection after round 3 blocks story
- reviewer uses separate provider/model config from worker
- reviewer timeout fails cleanly

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/review-loop.test.ts
```

Expected:
- missing reviewer loop behavior

**Step 3: Implement review loop**

Use:
- existing `review` command/result shape
- explicit reviewer round counters in Ralph state

MVP rule:
- implementation worker and reviewer are represented as separate roles/process phases
- story only reaches `approved` when reviewer returns no blocking findings
- reviewer invocation must accept provider/model overrides rather than silently using global defaults

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/review-loop.test.ts
```

Expected:
- pass

**Step 5: Commit**

```bash
git add src/features/ralph/execute.ts src/features/ralph/review-loop.test.ts
git commit -m "feat(ralph): require peer review before approval"
```

### Task 5.5: Add learning extraction and promotion scoring

**Files:**
- Create: `src/features/ralph/learnings.ts`
- Modify: `src/features/ralph/progress.ts`
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/learnings.test.ts`

**Step 1: Write failing tests**

Cover:
- classify learning as `story-local`, `repo-local`, `skill-local`, `doc-local`
- score learning based on repeatability, severity, and verification
- keep low-score learnings in progress only
- surface high-score learnings as promotion candidates

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/learnings.test.ts
```

Expected:
- module missing or scoring behavior absent

**Step 3: Implement minimal scoring engine**

Implement:
- classification helper
- additive scoring helper
- threshold helper returning promotion destination

MVP destinations:
- `progress_only`
- `candidate_agents`
- `candidate_docs`
- `candidate_skill`

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/learnings.test.ts
```

Expected:
- pass

**Step 5: Commit**

```bash
git add src/features/ralph/learnings.ts src/features/ralph/progress.ts src/features/ralph/execute.ts src/features/ralph/learnings.test.ts
git commit -m "feat(ralph): score learning promotion candidates"
```

### Task 6: Implement `ralph run` as fresh subprocess loop

**Files:**
- Modify: `src/features/ralph/cli.ts`
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/run.test.ts`

**Step 1: Write failing tests for `run`**

Cover:
- `run` repeatedly invokes fresh `step`
- stops on all stories passed
- stops on blocked story threshold / max iterations
- does not hold story state in memory between iterations
- parent process enforces global subprocess timeout policy

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/run.test.ts
```

Expected:
- missing `run` loop behavior

**Step 3: Implement parent orchestration**

Model:
- `run` selects/loops
- subprocess or injected process runner invokes `nooa ralph step`
- parent reloads state file after each iteration
- parent kills/records timed-out steps

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/run.test.ts
```

Expected:
- pass

**Step 5: Dogfood**

Run:

```bash
bun run index.ts ralph run --max-iterations 1 --json
```

Expected:
- valid loop summary

**Step 6: Commit**

```bash
git add src/features/ralph/cli.ts src/features/ralph/execute.ts src/features/ralph/run.test.ts
git commit -m "feat(ralph): add fresh-iteration run loop"
```

### Task 7: Add dedicated review/approve/promote-learning subcommands

**Files:**
- Modify: `src/features/ralph/cli.ts`
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/subcommands.test.ts`

**Step 1: Write failing tests**

Cover:
- `nooa ralph review --story US-001`
- `nooa ralph approve --story US-001`
- `nooa ralph promote-learning --story US-001 --json`

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/subcommands.test.ts
```

Expected:
- subcommands missing

**Step 3: Implement minimal subcommands**

Goals:
- keep `run` thin
- keep `review` and approval flows independently dogfoodable
- make learning promotion testable without running full loop
- ensure mutating subcommands acquire lock before changing Ralph state

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/subcommands.test.ts
```

Expected:
- pass

**Step 5: Dogfood**

Run:

```bash
bun run index.ts ralph review --help
bun run index.ts ralph promote-learning --help
```

Expected:
- clear, machine-usable command contracts

**Step 6: Commit**

```bash
git add src/features/ralph/cli.ts src/features/ralph/execute.ts src/features/ralph/subcommands.test.ts
git commit -m "feat(ralph): split review and promotion subcommands"
```

### Task 8: Integrate replay and progress artifacts

**Files:**
- Modify: `src/features/ralph/progress.ts`
- Modify: `src/features/ralph/execute.ts`
- Test: `src/features/ralph/progress.test.ts`

**Step 1: Write failing tests**

Cover:
- markdown progress append
- jsonl append
- replay node/edge registration on story progression

**Step 2: Run the targeted tests and confirm failure**

Run:

```bash
bun test src/features/ralph/progress.test.ts
```

Expected:
- missing dual-write or replay integration

**Step 3: Implement minimal integration**

Record:
- story attempts
- approvals
- commits
- blocked states

**Step 4: Run targeted tests again**

Run:

```bash
bun test src/features/ralph/progress.test.ts
```

Expected:
- pass

**Step 5: Commit**

```bash
git add src/features/ralph/progress.ts src/features/ralph/execute.ts src/features/ralph/progress.test.ts
git commit -m "feat(ralph): persist progress and replay state"
```

### Task 9: Final verification and docs

**Files:**
- Modify: `docs/features/ralph.md` (or generated feature docs path if this repo generates docs from command metadata)
- Verify: `src/features/ralph/*`

**Step 1: Run targeted feature tests**

Run:

```bash
bun test src/features/ralph/
```

Expected:
- all Ralph tests pass

**Step 2: Run full repository verification**

Run:

```bash
bun test
bun run check
```

Expected:
- pass

**Step 3: Dogfood final command surface**

Run:

```bash
bun run index.ts ralph --help
bun run index.ts ralph status --json
```

Expected:
- help and status are accurate

**Step 4: Request peer code review**

Use local review workflow and require findings-first output.

**Step 5: Commit**

```bash
git add src/features/ralph docs/features/ralph.md
git commit -m "feat(ralph): add autonomous backlog runner mvp"
```

---

## Execution Notes

- The macro-loop feature plan and story backlog must be peer-reviewed before `ralph run` is used for execution.
- The MVP may use `act` as the implementation worker, but the worker must not self-approve.
- Peer review is mandatory for story completion and may take up to 3 rounds.
- The implementation should prefer explicit state transitions over implicit booleans.
- `run` must preserve fresh-worker semantics by reloading on-disk state between iterations.
- Worker and reviewer must support distinct provider/model settings; global defaults alone are not sufficient.
- `init` must verify that `.nooa/ralph/` is git-ignored before the loop writes state there.
- `step` and `run` must enforce external timeouts; do not rely only on internal turn limits inside `act`.
- Learning promotion should be implemented as a scored proposal system first, not as automatic mutation of AGENTS/skills/docs.
- Smaller Ralph subcommands are a feature, not overhead; they are required for CLI-first dogfooding and safe iteration.
- Mutating Ralph subcommands must use a lock and atomic writes; do not allow concurrent state races on `.nooa/ralph/state.json`.
