# NOOA Debug Desktop Integration

This note captures what the `feat/debug-that-commands` worktree adds to the
desktop direction and what an agent should do when debugger-driven review does
not behave as expected.

## Why it matters

The desktop app already persists sessions, tool events, approvals, and workspace
history. A native `nooa debug` command family would extend that model with real
runtime evidence:

- paused source location
- locals and stack frames
- stable refs for frames, values, and breakpoints
- execution control such as continue and step

This shortens dogfooding loops by replacing print-debugging and speculative
patching with direct inspection.

## Expected NOOA debug shape

The useful V1 command family is:

```text
nooa debug <subcommand> [args] [flags]
```

Suggested subcommands:

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

## Desktop implications

The desktop UI should eventually render debugger output as structured events
instead of plain markdown. Recommended event families:

- `debug_session`
- `debug_state`
- `debug_breakpoint`
- `debug_stack`
- `debug_eval`

This keeps the chat timeline consistent with the existing `tool_read`,
`tool_write`, `tool_delete`, and approval cards.

## Agent guidance

When using an external debugger such as `debug-that`, prefer debugging the real
target process directly.

Good:

- launch the bridge process itself under the debugger
- launch the app entrypoint directly when the failure lives there
- attach to a long-lived process that already exposes inspector state

Bad:

- debugging only the parent test runner when the interesting code executes in a
  spawned subprocess

Why:

- the parent process can be fully visible while the actual failing state lives
  in a child Bun or Node process
- this produces "works but sees nothing useful" sessions during review

## What was observed locally

`debug-that` was useful for:

- fast state snapshots
- compact stack inspection
- lightweight runtime review

`debug-that` was not sufficient by itself for:

- reaching runtime state hidden behind a subprocess spawned by a test

That limitation should inform `nooa debug`: subprocess targeting and session
selection need to be first-class concerns, not afterthoughts.
