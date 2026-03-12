# NOOA Desktop Template

Tauri 2 desktop shell for a local NOOA coding agent, built with Bun, React, and TypeScript.

## What this template includes

- Chat-first desktop UI with a ChatGPT-like timeline
- Permanent workspace selector in the sidebar
- Two permission modes:
  - `Full Access`
  - `Ask First`
- Inline approval cards for filesystem actions
- Polished markdown rendering with custom code blocks, tables, and file path chips
- Real local bridge to NOOA's AI engine and file operations

## Current runtime contract

The desktop bridge currently supports three file actions inside the selected workspace:

- `read`
- `write`
- `delete`

All requested paths are normalized and rejected if they escape the chosen workspace root.

## Run it

From the repository root:

```bash
bun install
bun run desktop:dev
```

For a production build:

```bash
bun run desktop:build
```

## Notes

- The Tauri backend spawns `bun src/runtime/desktop/bridge.ts`.
- The bridge persists chat state under `<workspace>/.nooa/desktop/`.
- For real model responses, configure the same NOOA provider environment variables you already use in the repo.

## Future debug integration

The next major capability for the desktop app should be `nooa debug`.

The useful model, based on the `feat/debug-that-commands` worktree and a local
trial with `debug-that`, is:

- short-lived CLI commands over a persistent debug session
- compact state snapshots with source, locals, stack, and breakpoint refs
- desktop rendering that treats debugger output as first-class timeline events

Recommended desktop-facing debug actions:

- `launch`
- `attach`
- `status`
- `stop`
- `break`
- `break-ls`
- `break-rm`
- `continue`
- `step`
- `state`
- `vars`
- `stack`
- `eval`

Recommended desktop event cards for a future integration:

- `debug_session`
- `debug_state`
- `debug_breakpoint`
- `debug_stack`
- `debug_eval`

Operational note:

- debugger sessions are most useful when they target the real failing process
  directly
- if a test spawns a subprocess that contains the bug, a debugger attached to
  the parent test process will usually not see the child runtime state
- in those cases, prefer launching the target script or bridge process directly
  under `nooa debug` instead of only debugging the wrapper test
