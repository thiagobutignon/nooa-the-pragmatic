# Ralph Loop Integration Design

**Goal:** Add a Ralph-style autonomous iteration loop to NOOA while reusing the repository's existing primitives for worktrees, goals, workflows, gates, CI, review, replay, and agent runtime.

**Status:** Design only. No implementation in this document.

---

## 1. What Ralph Actually Is

After cloning and inspecting `snarktank/ralph`, the core of Ralph is much smaller than the hype around it:

1. A loop repeatedly spawns a **fresh agent instance**
2. Each iteration picks **one story** from a PRD-like backlog
3. The agent implements that story
4. It runs verification
5. If verification passes, it commits
6. It updates persistent on-disk state
7. The next fresh agent continues from files and git, not from in-memory conversation context

The important part is not the shell script. The important part is the **control model**:

- fresh context per iteration
- one story at a time
- file-based persistent state
- commit-based progress
- verification before story completion
- peer review by another AI before approval
- limited correction loops instead of infinite self-approval

That means we should not cargo-cult `ralph.sh`. We should preserve the control model while reusing stronger NOOA building blocks.

---

## 1.1 Non-Negotiable Workflow Alignment

This design must follow the repository's canonical workflow in:

- `docs/reference/ai-assisted-development-workflow.md`

That creates one hard requirement that is stronger than upstream Ralph:

- **the same agent cannot be the final reviewer of its own plan or its own story completion**

For `nooa ralph`, that means peer review by another AI is not optional polish. It is a required gate.

The loop therefore has to model two distinct review layers:

1. **Macro-loop review** for the feature plan/backlog before autonomous execution starts
2. **Micro-loop review** for each story before it is marked complete

Both review layers must support up to **3 rounds** of correction and re-review before approval or blockage.

---

## 2. What NOOA Already Has That Ralph Needs

NOOA already contains many of the primitives Ralph implements manually or only informally.

### Work isolation

- `src/features/worktree/cli.ts`
- `src/features/worktree/execute.ts`

This is already better than Ralph's raw branch handling because it:

- creates managed worktrees
- verifies branch names
- ensures `.worktrees` is ignored
- optionally installs deps
- optionally verifies tests on worktree creation
- emits telemetry/events

### Goal pinning

- `src/features/goal/cli.ts`
- `src/features/goal/execute.ts`

This gives us an existing place to pin:

- current feature goal
- current story goal
- loop objective for the active run

### Verification workflows and gates

- `src/features/workflow/cli.ts`
- `src/features/workflow/execute.ts`
- `src/features/gate/cli.ts`
- `docs/architecture/WORKFLOW_ENGINE.md`

This already models the exact kind of stepwise verification Ralph wants:

- spec
- test
- dogfood

It is more extensible than Ralph's plain "run some checks from prompt".

### CI and policy enforcement

- `src/features/ci/cli.ts`
- `src/features/check/cli.ts`

Ralph says "run quality checks". NOOA already has:

- a local CI command
- a policy/guardrail check command

That should be used instead of embedding ad-hoc test commands in a prompt.

### Review

- `src/features/review/cli.ts`
- `src/features/review/execute.ts`

Ralph's original loop does not natively include a structured review step. NOOA does. That is a quality upgrade we should preserve.

Important current limitation:

- `review` currently defaults to `process.env.NOOA_AI_PROVIDER`

That means worker and reviewer could accidentally use the same model/provider unless Ralph introduces explicit reviewer configuration.

### Replayable execution graph

- `src/features/replay/cli.ts`
- `src/features/replay/storage.ts`

Ralph has `progress.txt`. NOOA has the start of something structurally richer:

- replay nodes
- edges
- fixes
- step graph persistence

This is a strong candidate for recording story progression and iteration lineage.

### Agent runtime

- `src/runtime/agent/loop.ts`
- `src/features/act/engine.ts`

NOOA already has two orchestration directions:

1. `act` as a CLI-oriented orchestrator
2. `AgentLoop` as a tool-calling runtime kernel

That means we do **not** need Ralph to call an external agent binary in a blind shell loop forever. We can keep the "fresh iteration" invariant while using an internal agent runtime for each step.

### Persistent history patterns

- `src/features/eval/history.ts`
- session/history infrastructure under `src/runtime/session/`

These show we already know how to keep structured persistent state under `.nooa/`.

---

## 3. Core Decision: Do Not Copy Ralph As-Is

### What would be the naive port

The naive approach would be:

- add a `scripts/ralph.sh`
- store `prd.json` and `progress.txt`
- call `nooa act` in a loop

This would work as a demo, but it would be the wrong long-term architecture because it would bypass or duplicate existing NOOA systems:

- duplicate worktree/branch orchestration
- duplicate loop state handling
- duplicate verification semantics
- bypass replay and event schema
- keep progress in a less structured format than NOOA can already support

### Recommended approach

Build a **native `nooa ralph` feature** that preserves Ralph's control model but uses NOOA's existing primitives wherever possible.

That means:

- keep fresh iteration semantics
- keep one-story-per-iteration semantics
- keep file-backed persistent state
- but implement the loop through NOOA commands, state files, and runtime components

---

## 4. Recommended Architecture

### 4.1 Add a Native Feature Slice

Create:

```text
src/features/ralph/
  cli.ts
  execute.ts
  state.ts
  prd.ts
  progress.ts
  selector.ts
  archive.ts
  prompts.ts
```

This should be a self-evolving module, not a loose script.

### 4.2 Command Surface

Recommended CLI:

```text
nooa ralph init
nooa ralph import-prd
nooa ralph select-story
nooa ralph status
nooa ralph step
nooa ralph review
nooa ralph approve
nooa ralph promote-learning
nooa ralph run
nooa ralph archive
nooa ralph reset
```

Suggested responsibilities:

- `init`: create `.nooa/ralph/` state for a feature run
- `import-prd`: convert markdown PRD or JSON into loop state
- `select-story`: choose the next executable story and explain why
- `status`: show run, branch, current story, pending stories, verification status
- `step`: run exactly one fresh iteration against one story
- `review`: run only the peer-review phase for a specific story/attempt
- `approve`: mark a reviewed story as approved when all gates are satisfied
- `promote-learning`: evaluate whether a learning should remain local, go to AGENTS, or become a skill/doc update
- `run`: repeat `step` up to N iterations
- `archive`: archive completed or abandoned run state
- `reset`: reset story pass flags or progress safely

Recommended operational flags to add early:

- `--worker-provider`
- `--worker-model`
- `--reviewer-provider`
- `--reviewer-model`
- `--worker-timeout-ms`
- `--review-timeout-ms`
- `--max-review-rounds`

### 4.3 State Location

Do **not** store primary state beside an arbitrary shell script like upstream Ralph.

Use:

```text
.nooa/ralph/
  prd.json
  progress.md
  progress.jsonl
  state.json
  state.lock
  archive/
```

Recommended file responsibilities:

- `prd.json`: Ralph-compatible backlog and story states
- `progress.md`: human-readable append-only status
- `progress.jsonl`: machine-readable event/progress log
- `state.json`: current branch/worktree/run metadata
- `archive/`: archived previous runs

This gives us both:

- compatibility with Ralph's mental model
- structured state for NOOA-native automation

Important repository safety rule:

- `.nooa/ralph/` must be ignored by git before the loop is considered safe to run

### 4.4 Why Smaller Subcommands Matter

Ralph should not be implemented as one giant opaque command with an oversized `execute.ts`.

Breaking the loop into smaller subcommands gives us:

- better TDD granularity
- real CLI-first dogfooding at every stage
- easier debugging when one phase regresses
- safer iterative rollout before the full autonomous loop is trusted
- the ability to reuse parts of Ralph without running the whole loop

Recommended design principle:

- `run` should orchestrate
- `step` should execute one story
- `review` should encapsulate peer-review logic
- `promote-learning` should encapsulate knowledge promotion logic
- `status` should expose the loop state as machine-readable output

This keeps the feature evolvable instead of turning it into one fragile stateful blob.

### 4.4.1 Concurrency and state safety

Once Ralph is decomposed into smaller subcommands, state safety becomes an explicit concern.

Risk:

- `step`, `review`, `approve`, or `promote-learning` could mutate `.nooa/ralph/state.json` concurrently

Minimum requirement:

- state writes must be atomic
- mutating commands must acquire a Ralph state lock
- autonomous `run` mode should act as the exclusive writer

Recommended policy:

- read-only subcommands may inspect state freely
- mutating subcommands must fail fast if a lock is already held
- lock failures should return a clear "Ralph run already active" style error instead of racing

### 4.4 Fresh Iteration Semantics

This is the most important part to get right.

Ralph's key invariant is: **each iteration is a fresh agent instance**.

To preserve that in NOOA, `nooa ralph run` should **not** keep one long in-memory loop. Instead, it should orchestrate repeated subprocess executions of `nooa ralph step`.

Recommended model:

```text
nooa ralph run
  -> selects next pending story
  -> spawns fresh subprocess: nooa ralph step --story US-00X --run-id ...
  -> subprocess loads only on-disk state
  -> subprocess executes one story
  -> subprocess exits
  -> parent process inspects updated state
  -> repeat if needed
```

Why this is better:

- preserves fresh context
- prevents hidden in-memory coupling between iterations
- makes crash recovery easier
- keeps state externalized
- matches Ralph's original advantage

This is the right place to emulate Ralph's shell loop, but as a NOOA command instead of a standalone bash script.

### 4.5 Macro-Loop vs Micro-Loop

The biggest correction to the earlier draft is that `nooa ralph` should not flatten the whole workflow into one repeated "implement and commit" cycle.

It needs two levels:

### Macro-loop: feature approval loop

This happens **before** `nooa ralph run`.

Sequence:

1. write feature plan
2. submit plan to another AI reviewer
3. apply corrections
4. resubmit
5. repeat up to 3 review rounds
6. approve story backlog
7. initialize Ralph run state

The macro-loop should produce an approved backlog, not code.

### Micro-loop: story execution loop

This happens **inside** `nooa ralph step`.

Sequence:

1. select one story
2. execute implementation with fresh worker
3. run TDD and verification
4. send result to another AI reviewer
5. if findings exist, apply corrections
6. repeat review up to 3 rounds
7. only then commit and mark the story passed

This separation matters because:

- planning review and story review solve different problems
- plan review catches wrong decomposition and wrong architecture
- story review catches local bugs, regressions, and theatrical code
- forcing full plan review in every story iteration would be redundant and expensive

### 4.6 Reviewer Identity Separation

Peer review is only meaningful if the reviewer is not just the same model wearing a different hat.

Current repository reality:

- `review` defaults to `NOOA_AI_PROVIDER`
- `act` can also run against the same global provider/model settings

Therefore Ralph must introduce explicit worker vs reviewer configuration.

Minimum requirement:

- separate config keys for worker and reviewer provider/model
- reviewer defaults should not silently alias worker defaults

Recommended environment/config split:

```text
NOOA_RALPH_WORKER_PROVIDER
NOOA_RALPH_WORKER_MODEL
NOOA_RALPH_REVIEWER_PROVIDER
NOOA_RALPH_REVIEWER_MODEL
NOOA_RALPH_REVIEWER_TEMPERATURE=0
```

Recommended policy:

- reviewer should default to temperature `0`
- reviewer should prefer a different model family when available
- if worker and reviewer resolve to the same provider/model pair, Ralph should warn or fail depending on strictness mode

This is required to uphold the "different AI reviewer" rule in practice, not just in prose.

---

## 5. How Each Ralph Concern Maps to NOOA

| Ralph concern | Ralph upstream | NOOA-native mapping |
|---|---|---|
| Fresh iterations | `ralph.sh` respawns CLI | `nooa ralph run` respawns `nooa ralph step` |
| Branch handling | script checks branch from `prd.json` | reuse `worktree create/info/remove` |
| PRD backlog | `prd.json` | `.nooa/ralph/prd.json` with compatibility |
| Progress memory | `progress.txt` | `.nooa/ralph/progress.md` + `progress.jsonl` |
| Verification | prompt says run checks | reuse `workflow`, `gate`, `ci`, `check`, `review` |
| Context memory | git + progress + AGENTS | same, plus `goal`, replay, event log |
| Loop status | grep JSON + print lines | `ralph status` command |
| Archiving | shell copies files | dedicated `archive.ts` |

---

## 6. Recommended Execution Flow

### 6.1 `nooa ralph init`

Responsibilities:

1. validate repo state
2. create or select feature worktree
3. initialize `.nooa/ralph/`
4. pin feature-level goal via `goal set`
5. import/create story backlog
6. persist macro-loop review state

Should reuse:

- `worktree`
- `goal`
- self-evolving module patterns

### 6.2 `nooa ralph step`

This is the heart of the system.

Responsibilities:

1. load run state
2. choose highest-priority story with `passes: false`
3. set the current story as active goal
4. build story-specific prompt/context from:
   - story definition
   - feature goal
   - progress log
   - relevant AGENTS/workspace files
5. execute exactly one fresh implementation worker
6. run TDD / CLI-first / verification pipeline
7. submit result to a **different AI reviewer**
8. if findings exist, execute a fresh correction worker
9. repeat peer review/correction up to 3 rounds
10. commit only after peer approval
11. mark story as passed
12. append progress
13. record replay/event data

### 6.2.1 Timeout semantics

`ralph step` must impose timeout limits around long-running workers and review calls.

Why:

- `act` can continue iterating internally
- verification can get stuck behind failing loops
- a fresh-iteration architecture is useless if one iteration never terminates

Minimum requirement:

- worker subprocess timeout
- reviewer subprocess timeout
- explicit failure state when timeout is reached
- timeout reason written to progress and state

Recommended behavior:

- kill the subprocess
- record `failed` with reason `timeout`
- increment failure count
- do not leave the story in `implementing` forever

### 6.3 `nooa ralph run`

Responsibilities:

1. loop `step` N times
2. stop on completion
3. stop on repeated failure threshold
4. show summary at the end

The parent command should stay thin. The real work should live in `step`.

### 6.4 Story implementation order

The micro-loop should respect architectural dependency order, not blindly force all layers.

Preferred order:

1. plan already approved at macro level
2. TDD
3. core behavior / CLI-first proof
4. API adapter if the story requires it
5. UI adapter if the story requires it
6. verification
7. peer review loop
8. commit

This means `CLI -> API -> UI` is a dependency ordering principle, not a mandatory checklist for every story.

### 6.6 Learning extraction and promotion

Ralph should not only execute stories. It should also accumulate and classify learnings for future iterations and future agents.

But promotion of learnings must be selective. Otherwise the loop becomes a documentation spam machine.

Recommended pipeline:

```text
extract learning
  -> classify scope
  -> score promotion value
  -> choose destination
  -> require review for durable promotion
```

Recommended destinations:

- `story-local`: keep only in `.nooa/ralph/progress.md` and `.jsonl`
- `repo-local`: candidate for `AGENTS.md`
- `skill-local`: candidate for `.agent/skills/*`
- `doc-local`: candidate for docs/reference or docs/architecture

### 6.6.1 Promotion scoring algorithm

Each learning should be scored across a small set of dimensions:

- `reusability`: will this help more than one story?
- `frequency`: did this appear multiple times?
- `severity`: did it prevent a real failure or review rejection?
- `scope`: does it affect a directory, command, or the whole repo?
- `stability`: is this a stable rule rather than a temporary workaround?
- `verification`: was it confirmed by tests, review, or repeated observation?
- `promotion_cost`: how expensive/noisy is it to encode this permanently?

Suggested additive heuristic:

```text
+3 if observed in 2 or more stories
+3 if it prevented CI/review/timeout failure
+2 if it affects a reusable command/feature pattern
+2 if explicitly confirmed during peer review
-3 if it looks story-specific or temporary
-2 if it depends on local one-off context
```

Suggested thresholds:

- `<= 2`: keep in run-local progress only
- `3-5`: keep in progress and maybe surface in status
- `6-8`: propose promotion to `AGENTS.md` or local docs
- `>= 9`: propose promotion to skill or long-lived process artifact

### 6.6.2 Promotion guardrails

No learning should promote to durable repo guidance automatically without review.

Rules:

- promotion to `AGENTS.md` requires peer review
- promotion to `.agent/skills/*` requires peer review and use of `writing-skills`
- promotion affecting CLI/commands must also respect `self-evolving-modules`
- story-specific learnings must not be upgraded into fake global rules

### 6.5 Headless worker contract

The MVP proposes to reuse `act` as the implementation worker, but `act` is currently a broad autonomous orchestrator, not a narrow story runner.

That means the Ralph MVP must define a stricter headless worker contract.

Minimum requirement for the worker invocation:

- no interactive prompts
- explicit story-scoped goal
- explicit machine-readable result
- explicit max turns
- clean success/failure exit

Recommended direction:

- either add a Ralph-specific wrapper around `act`
- or extend `act` with a stricter mode for story execution

Example target shape:

```bash
nooa act "Implement story US-003" \
  --json \
  --turns 8 \
  --provider "$NOOA_RALPH_WORKER_PROVIDER" \
  --model "$NOOA_RALPH_WORKER_MODEL"
```

Better future shape:

- worker input also receives story file/state path
- worker receives constrained context assembled from `.nooa/ralph/prd.json`, active story, progress, and goal

Without this, `act` risks operating with too much freedom and too much repository surface.

---

## 7. Which Existing NOOA Orchestrator Should We Reuse?

This is a key design choice.

### Option A: Build on top of `act`

Pros:

- already autonomous
- already command-oriented
- already understands `nooa` subcommands
- already has verification hook behavior

Cons:

- prompt structure is generic, not story-state-machine-specific
- today it is not designed around PRD backlog state transitions
- it is closer to "one freeform autonomous objective" than "Ralph story executor"

### Option B: Build on top of `AgentLoop`

Pros:

- cleaner runtime abstraction
- better foundation for tool-calling orchestration
- easier to specialize per-story worker behavior
- more future-proof if we want richer subagents

Cons:

- requires more explicit Ralph-specific orchestration code
- slightly more implementation effort up front

### Recommendation

Use a **hybrid approach**:

- **MVP:** use `act` as the worker engine for `ralph step`
- **Target architecture:** move the per-story worker onto `AgentLoop`

Reasoning:

- `act` gets us to a working loop faster
- `AgentLoop` is the better end-state for a first-class NOOA autonomous subsystem
- we should not block the first usable version on the more ambitious runtime refactor

---

## 8. Verification Strategy

Ralph without strong feedback loops degenerates quickly. NOOA already has stronger gates than upstream Ralph, so we should use them.

### Minimum recommended story completion contract

A story should only flip to `passes: true` when:

1. implementation completed without runtime failure
2. `nooa workflow run` passes for required gates
3. `nooa ci` passes
4. `nooa review --fail-on high` does not find blocking issues
5. a **different AI reviewer** approves the story
6. a commit was created successfully

### Peer review must not be self-review

The implementation worker cannot approve itself.

Required invariant:

- worker A implements
- reviewer B reviews
- if B finds issues, worker A2 or A3 fixes in a fresh iteration
- reviewer B2 or B3 re-reviews
- maximum 3 review rounds

This is the key protection against the worker simply agreeing with its own output.

### Gate selection

Suggested defaults by story type:

- backend logic: `spec,test`
- CLI/command: `spec,test,dogfood`
- UI: `spec,test,dogfood` plus browser verification later when that exists in-project

### Why this is better than upstream Ralph

Upstream Ralph mostly delegates verification discipline to prompt instructions. NOOA can enforce it with commands and structured results.

---

## 9. Progress and Memory Design

Ralph uses `progress.txt` as a simple append-only memory layer. We should preserve the human readability but enrich the structure.

### Recommended dual-write model

On each successful or failed step, write to:

1. `progress.md`
2. `progress.jsonl`

`progress.md` is for humans and future agents reading a narrative summary.

`progress.jsonl` is for:

- status calculation
- dashboards
- resumability
- filtering by story
- future analytics

### Suggested progress entry shape

```json
{
  "timestamp": "2026-03-03T12:34:56.000Z",
  "runId": "ralph-2026-03-03-auth",
  "storyId": "US-003",
  "iteration": 4,
  "status": "passed",
  "commit": "abc1234",
  "gates": {
    "workflow": true,
    "ci": true,
    "review": true
  },
  "reviewRounds": 2,
  "reviewers": ["peer-review-1", "peer-review-2"],
  "learnings": [
    {
      "text": "This command requires gate+ci before review",
      "scope": "repo-local",
      "score": 8,
      "promotion": "candidate_agents"
    }
  ],
  "notes": [
    "Reused existing worktree branch",
    "Added AGENTS.md note for API sync rule"
  ]
}
```

### Reuse of replay

The replay graph should be used to capture:

- story execution order
- fix branches from failed attempts
- impacts between stories

That gives NOOA something Ralph does not have: replayable structural reasoning over autonomous progress.

---

## 10. PRD Format Strategy

We should **support Ralph-compatible `prd.json`**, but we should not make ourselves hostage to only that exact file layout forever.

### Recommendation

- support importing upstream Ralph `prd.json`
- store a compatible representation in `.nooa/ralph/prd.json`
- allow NOOA-native metadata extensions

Suggested extension fields:

- `state`: `pending | running | passed | failed | blocked`
- `lastAttemptAt`
- `lastCommit`
- `verification`
- `worktree`
- `runNotes`
- `reviewRounds`
- `lastReviewer`
- `reviewState`
- `learnings`
- `promotionCandidates`

This lets us stay compatible while becoming more expressive.

---

## 11. Worktree Strategy

Do not create one worktree per story by default.

### Recommended default

One worktree per Ralph run/feature branch.

Why:

- keeps related feature work coherent
- preserves cumulative code progress like upstream Ralph
- avoids worktree explosion
- matches the fact that stories are sequential within one feature backlog

### When a separate worktree makes sense

Only for:

- isolated experiments
- large blocked stories
- explicit branch split

That should be an opt-in strategy, not the default.

---

## 11.1 Git Hygiene for Ralph State

Ralph's state files are operational artifacts, not product source files.

Current repository reality:

- `.nooa/ralph/` is not explicitly ignored in the root `.gitignore`

Therefore the implementation must either:

1. add `.nooa/ralph/` to `.gitignore`
2. or ensure `init` adds/verifies the ignore rule before writing loop state

This should be treated as a safety precondition, not as optional cleanup.

---

## 12. Failure Handling

A good Ralph loop needs more than "continue until done".

### Recommended stop conditions

Stop `run` when:

- all stories passed
- max iterations reached
- same story failed N consecutive times
- verification repeatedly fails without code delta
- peer review fails 3 rounds in a row
- worker timeout threshold reached
- reviewer timeout threshold reached
- worktree becomes irrecoverably dirty/conflicted

### Recommended failure state transitions

If a story fails:

- keep `passes: false`
- increment failure count
- write structured failure entry
- optionally mark `state: blocked` after threshold
- preserve peer review findings so the next correction worker does not start blind

This is better than simply trying forever.

---

## 12.1 Story State Machine

Each story should move through explicit states instead of only flipping `passes`.

Recommended state progression:

```text
pending
  -> implementing
  -> verifying
  -> peer_review_1
  -> peer_fix_1
  -> peer_review_2
  -> peer_fix_2
  -> peer_review_3
  -> approved
  -> committed
  -> passed
```

Possible failure states:

```text
failed
blocked
```

Rules:

- any review round may return `approved`
- after review round 3, if still not approved, mark `blocked`
- only `approved` stories may commit
- only committed stories may set `passes: true`

---

## 13. Best MVP for NOOA

If we want the best first version with maximal reuse and low churn, the MVP should be:

### New command

`nooa ralph`

### First subcommands

- `status`
- `step`
- `run`
- `import-prd`

### First implementation choices

- use `.nooa/ralph/prd.json`
- use `.nooa/ralph/progress.md`
- use `.nooa/ralph/state.json` for story/review state
- use existing `worktree`
- use existing `goal`
- use `act` as the worker for a single story
- use `workflow` + `ci` + `review` as completion gates
- add mandatory peer review round-trip before approval
- append replay entries for each completed step

This gives a real usable Ralph loop quickly while staying aligned with NOOA's architecture.

---

## 14. Better-Than-MVP Target

Once MVP works, the stronger version should:

1. replace `act` worker internals with `AgentLoop` specialization
2. add structured `progress.jsonl`
3. add archive/resume support
4. add richer story state transitions
5. add optional `cron`-driven autonomous background execution
6. expose events for TUI/live monitoring
7. add learning-promotion automation with human/peer-reviewed promotion patches

This would make Ralph not just "ported" into NOOA, but upgraded by it.

---

## 15. Concrete Implementation Phases

### Phase 1: Compatibility MVP

Create:

- `src/features/ralph/cli.ts`
- `src/features/ralph/execute.ts`
- `src/features/ralph/state.ts`
- `src/features/ralph/prd.ts`
- `src/features/ralph/progress.ts`

Capabilities:

- import PRD
- show status
- execute one story
- run N iterations
- model peer review rounds up to 3
- block story completion without external review approval

Reuse:

- `worktree`
- `goal`
- `act`
- `workflow`
- `ci`
- `review`

### Phase 1.5: Macro-Loop Approval

Add:

- approved backlog state
- plan review metadata
- explicit "ready for ralph run" gate

The feature backlog must not enter autonomous execution until macro-loop peer review is complete.

### Phase 2: Native State and Replay

Add:

- structured progress file
- replay graph integration
- archive/resume support
- richer failure state
- learning extraction and promotion scoring

### Phase 3: Runtime Upgrade

Replace or augment:

- `act`-based worker with `AgentLoop`-based worker

### Phase 4: Automation Plane

Add:

- background execution via `cron`
- TUI/live tail support
- evaluation metrics on autonomous runs
- promotion flows that generate candidate AGENTS/skill/doc patches instead of silently mutating process assets

---

## 16. Final Recommendation

The best way to implement Ralph loop in NOOA is:

- **do not port the shell script as the primary architecture**
- **implement a native `nooa ralph` command**
- **preserve Ralph's invariants**
- **reuse NOOA's stronger primitives for everything else**

In one sentence:

> Build Ralph as a NOOA-native autonomous backlog runner where a peer-reviewed plan produces an approved story backlog, `run` respawns fresh `step` workers, and each story must pass TDD, CLI-first verification, NOOA gates, and up to 3 rounds of review by another AI before it can commit and mark `passes: true`.

That gets us the value of Ralph without creating a second, weaker orchestration stack beside the one we already have.
