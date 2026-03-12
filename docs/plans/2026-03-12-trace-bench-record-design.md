# NOOA Trace, Record, and Bench Design

**Date:** 2026-03-12

**Goal:** Introduce `nooa trace`, `nooa record`, and `nooa bench` as agent-first execution evidence primitives, starting with local atomic command execution and leaving clean seams for future workflow-level orchestration traces.

## Problem

NOOA now has strong debugging and profiling primitives, but it still lacks a first-class execution trace primitive. When a command succeeds slowly, fails noisily, spawns subprocesses, or mutates files in unexpected ways, the current evidence is fragmented:

- `debug` explains runtime state at a pause boundary
- `profile` explains CPU hotspots
- `replay` explains graph relationships between steps and fixes

What is missing is a canonical execution artifact describing what happened during one command run.

That artifact should be useful immediately for:

- dogfooding
- debugging CLI regressions
- grounding agent decisions in evidence
- linking failures to `debug`, `profile`, and `replay`

## Product Shape

The product should be built in three layers:

1. `trace`
2. `record`
3. `bench`

Each command should remain useful on its own.

### `trace`

Primary question:

> What happened during this execution?

V1 command:

```text
nooa trace inspect -- <command...>
```

Example uses:

- `nooa trace inspect -- bun test src/features/debug`
- `nooa trace inspect -- node script.js`
- `nooa trace inspect -- nooa debug inspect-test-failure -- bun test path/to/test.ts`

V1 output should capture:

- `traceId`
- `parentTraceId?`
- `spanId`
- command and cwd
- started/finished timestamps
- duration
- exit code or signal
- stdout/stderr summaries
- subprocesses observed
- files touched
- refs to related debug/profile/replay artifacts when available

### `record`

Primary question:

> What raw execution artifact can I replay or inspect later?

V1 command:

```text
nooa record inspect -- <command...>
```

`record` should capture a more complete artifact than `trace`, including:

- full command and cwd
- sanitized environment metadata
- stdout/stderr payloads, optionally truncated by policy
- file touch list
- timestamps
- trace linkage

`record` is the artifact for detailed re-inspection. `trace` is the compact summary.

### `bench`

Primary question:

> How fast or expensive is this command, and is it getting better or worse?

V1 command:

```text
nooa bench inspect -- <command...>
```

V1 should stay narrow:

- repeat a command multiple times
- compute min/median/max duration
- report success rate
- keep references to the underlying traces

This makes `bench` a metrics layer built on top of repeated traced executions.

## Recommended V1 Scope

Keep V1 strictly local and atomic.

The unit of truth should be one command execution, not a whole agent workflow.

This aligns with the current NOOA direction:

- `debug` is an atomic runtime investigation
- `profile` is an atomic hotspot investigation
- `trace` should be an atomic execution investigation

## Explicit Non-Goals For V1

Do not include these in V1:

- distributed workflow traces across `act`, `run`, `ralph`, and `replay`
- span propagation across the full agent graph
- full system-call-level tracing
- OS-specific tracer dependencies like `strace`, `dtruss`, or eBPF requirements
- definitive file read coverage
- memory/cpu benchmarking beyond simple duration-driven bench summaries

These belong in later phases once the base artifact is stable.

## Architecture

### 1. Execution-first schema

The V1 schema should already carry orchestration hooks:

- `traceId`
- `parentTraceId`
- `spanId`

Even if V1 usually emits root traces, this avoids painting the design into a corner.

### 2. Separate storage, shared semantics

Storage layout should be feature-local but semantically aligned:

- `.nooa/traces/<traceId>.json`
- `.nooa/records/<recordId>.json`
- `.nooa/bench/<benchId>.json`

Relationships:

- a trace may reference a record
- a bench run references many traces
- a replay node can embed trace/profile/debug links

### 3. CLI-first and self-describing

Each feature must follow the NOOA `CommandBuilder` pattern:

- metadata
- help
- schema
- examples
- errors
- output fields

That keeps docs and future agent affordances generated from source.

### 4. Runtime collection strategy

V1 should prefer portable collection mechanisms already available in the runtime:

- direct process execution
- explicit timestamping
- stdout/stderr capture
- git/workspace diffing for touched files when practical
- process tree observation only when a subprocess can be identified reliably from the parent process wrapper

Do not block V1 on perfect subprocess or filesystem instrumentation.

The rule is:

> Collect useful evidence portably first, then deepen fidelity later.

## Data Model

### Trace artifact

Core shape:

- `traceId`
- `parentTraceId`
- `spanId`
- `command`
- `cwd`
- `startedAt`
- `finishedAt`
- `durationMs`
- `exitCode`
- `signal`
- `stdoutSummary`
- `stderrSummary`
- `subprocesses`
- `filesTouched`
- `links`

`links` should allow:

- `debugSession`
- `profilePath`
- `recordId`
- `replayNodeId`

### Record artifact

Core shape:

- `recordId`
- `traceId`
- `command`
- `cwd`
- `env`
- `startedAt`
- `finishedAt`
- `durationMs`
- `exitCode`
- `signal`
- `stdout`
- `stderr`
- `filesTouched`

### Bench artifact

Core shape:

- `benchId`
- `command`
- `cwd`
- `runs`
- `startedAt`
- `finishedAt`
- `durationStats`
- `successRate`
- `traceIds`

## Integration Direction

The expected layering is:

1. `trace` becomes the canonical execution summary
2. `record` becomes the deeper raw execution artifact
3. `bench` becomes repeated execution analysis over trace artifacts
4. `act` / `run` / `ralph` later emit parent and child traces

This separates two different semantics that should not be conflated:

- execution tracing
- agent/workflow tracing

## Error Handling

Representative error codes:

- `trace.missing_subcommand`
- `trace.invalid_target`
- `trace.runtime_error`
- `record.missing_subcommand`
- `record.invalid_target`
- `record.runtime_error`
- `bench.missing_subcommand`
- `bench.invalid_target`
- `bench.runtime_error`

Validation errors should map to exit code `2`. Runtime failures should map to exit code `1`.

## Testing Strategy

Each feature should prove both contract and execution behavior.

Required layers:

- CLI parser tests
- execute/storage unit tests
- direct command integration tests using small fixtures

Minimum smoke scenarios:

1. `trace inspect` records a successful command
2. `trace inspect` records a failing command
3. `record inspect` persists stdout/stderr and touched files
4. `bench inspect` runs repeated commands and computes duration stats
5. `trace` / `record` / `bench` all emit JSON consumable by agents

## Delivery Sequence

Build in this order:

1. `trace` storage and CLI
2. `trace` execution capture
3. `record` built on the same execution collector
4. `bench` using repeated traced runs
5. docs and skill updates only after behavior is stable

This gives the fastest path to immediate value while preserving the architecture needed for workflow-level tracing later.
