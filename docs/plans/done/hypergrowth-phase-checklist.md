# Hypergrowth Phase Checklist

## Phase 1: Foundation Repairs (The Plumbing)

**Goal**: Make the existing machinery reliable.

- [ ] **EventBus**
  - [ ] 0 skipped tests
  - [ ] 100% coverage
  - [ ] No regression on existing commands
- **Event Schema**
  - [ ] `EVENT_SCHEMA.md` approved
  - [ ] `src/core/events/schema.ts` implemented
- **Worktree Pool**
  - [ ] `Pool.ts` implementation (Acquire/Release)
  - [ ] Timeout logic works
  - [ ] Cleanup logic works

## Phase 2: Workflow Engine (The Enforcer)

**Goal**: Code the discipline.

- **Gates**
  - [ ] `Gate` interface specificied
  - [ ] `SpecGate` detects missing docs
  - [ ] `TestGate` parses `bun test` output
  - [ ] `DogfoodGate` runs subprocess
- **Engine**
  - [ ] `WorkflowEngine.run()` halts on gate failure
- **Integration**
  - [ ] `nooa act` uses Engine

## Phase 3: TUI Observer (The Face)

**Goal**: Visualize the truth.

- **Dashboard**
  - [ ] Connects to EventBus
  - [ ] Displays TraceID
  - [ ] Displays "Traffic Light" for Gates
- **Modes**
  - [ ] Read-only (`--tail`)
  - [ ] Interactive (Phase 4)

## Phase 4: Parallelism (Scale)

- [ ] Parallel `act` dispatch
- [ ] 5 workers stable
