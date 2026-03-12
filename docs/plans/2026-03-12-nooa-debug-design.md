# NOOA Debug Design

**Date:** 2026-03-12

**Goal:** Introduce a native `nooa debug` command family that provides real breakpoint-driven debugging for Node.js and Bun, while fitting NOOA's existing CLI, telemetry, replay, and future Ralph/dogfooding workflows.

## Problem

NOOA has strong verification and orchestration primitives, but it lacks a first-class runtime debugger. When a command fails during dogfooding or Ralph execution, the current path is mostly indirect: inspect code, rerun commands, add logging, or iterate patches. That works, but it is slower and less evidence-driven than pausing a real process, inspecting locals, stepping execution, and evaluating expressions at the failing frame.

The `debug-that` project demonstrates that a compact CLI can expose real debugging capability to agents. The useful part to bring into NOOA is not its exact code layout; it is the model:

- short-lived CLI commands over a persistent debug session
- breakpoints and stepping against real runtime state
- compact source/locals/stack output
- stable handles for frames and values

## Product Shape

The V1 entry point should be:

```text
nooa debug <subcommand> [args] [flags]
```

Initial subcommands:

- `launch [--brk] <command...>`
- `attach <pid|port|ws-url>`
- `status`
- `stop`
- `break <file>:<line>`
- `break-ls`
- `break-rm <BP#|all>`
- `continue`
- `step [over|into|out]`
- `state`
- `vars`
- `stack`
- `eval <expression>`

This keeps the interface discoverable and close to the model proven by `debug-that`, while still living cleanly inside NOOA's command architecture.

## Non-Goals For V1

Do not include these in the first implementation:

- LLDB / DAP support
- Python / Go / Java runtimes
- hotpatching
- return value mutation
- advanced sourcemap authoring or repair
- deep artifact review UI
- automatic Ralph orchestration

These can come later once the core session lifecycle is reliable.

## Architecture

### 1. NOOA command surface

`src/features/debug/cli.ts` will own the public contract using `CommandBuilder`, including:

- metadata
- schema
- help text
- examples
- error codes
- success output fields
- telemetry hooks

This keeps `nooa debug` consistent with other NOOA commands and lets docs/agent-facing artifacts derive from the same source of truth.

### 2. Persistent debug sessions

The debugging model should be stateless at the CLI layer and stateful underneath. Each command invocation will connect to a named session, defaulting to `"default"`.

Session responsibilities:

- spawn or attach target process
- connect to runtime inspector endpoint
- track current execution state (`idle`, `running`, `paused`)
- manage breakpoint registry
- cache current pause location, stack, and ref table
- survive across multiple CLI invocations

The session manager should be implemented as NOOA-owned code under `src/features/debug/session/`.

### 3. Runtime adapters

V1 should support:

- Node.js inspector
- Bun inspector

The public session layer should not care which runtime is underneath. A thin adapter interface should normalize:

- launch / attach
- set and remove breakpoints
- continue / pause / step
- stack frame retrieval
- scope and variable inspection
- expression evaluation
- source retrieval

This allows future DAP runtimes without rewriting the command surface.

### 4. Stable refs

NOOA should expose short handles for inspected entities:

- frames: `@f0`
- variables/values: `@v1`
- breakpoints: `BP#1`

Refs are session-local and ephemeral. They are a UX primitive, not a persistence primitive. The session should rebuild them on each pause boundary and clear volatile refs when execution resumes.

## Output Model

Human output should be compact and evidence-dense:

- paused location
- short source excerpt
- locals
- stack
- active breakpoint count

JSON output should be structured enough for NOOA internals and future Ralph integration:

- `session`
- `state`
- `runtime`
- `location`
- `source`
- `vars`
- `stack`
- `breakpoints`
- `traceId`

## Integration Direction

V1 does not need full integration, but the design must keep clear seams for:

- `replay`: record debug actions and key pause snapshots
- `dogfood`: invoke `nooa debug` when a real process repro exists
- `ralph`: open an investigation step that gathers runtime evidence before patching

The key rule is that `nooa debug` must be a usable standalone command first. Ralph and dogfooding should consume it later, not define it prematurely.

## Error Handling

Representative error codes:

- `debug.missing_subcommand`
- `debug.no_active_session`
- `debug.invalid_target`
- `debug.invalid_breakpoint`
- `debug.attach_failed`
- `debug.launch_failed`
- `debug.runtime_error`
- `debug.not_paused`
- `debug.unsupported_runtime`

Validation errors should map to exit code `2`. Runtime/debugger failures should map to exit code `1`.

## Testing Strategy

V1 must prove real behavior, not just parser correctness.

Required test layers:

- unit tests for input parsing and ref bookkeeping
- unit tests for session state transitions
- adapter-focused tests where protocol behavior can be mocked
- integration tests launching real Node and Bun fixtures

Required smoke scenarios:

1. launch with `--brk`
2. inspect paused state
3. set breakpoint by file:line
4. continue to breakpoint
5. step over
6. inspect locals and stack
7. evaluate expression
8. stop session

## Recommended Delivery Sequence

Build the feature in this order:

1. CLI contract and parser
2. session store and lifecycle
3. Node adapter
4. `launch`, `status`, `stop`
5. `state`, `vars`, `stack`
6. `break`, `break-ls`, `break-rm`
7. `continue`, `step`
8. `eval`
9. Bun adapter
10. docs and final dogfooding

This minimizes early complexity and gets real value quickly.
