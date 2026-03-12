# NOOA Debug Emergent Behavior

## Why This Exists

This document records the most important architectural lessons that emerged while implementing `nooa debug`.

The key point is not just that the feature is progressing. The more important signal is what the work revealed about the kind of system NOOA is becoming.

## What Emerged

### 1. Dogfooding became a design instrument

The most useful discoveries did not come from static design alone. They came from running the real CLI against a real debug target.

The sequence:

- implement
- dogfood
- observe real failure
- isolate the actual cause
- adjust architecture

This is materially different from using dogfooding as a final validation step. It is now acting as an input to design.

Example:

- `launch` and `continue` appeared to work
- `vars` and `eval` failed in the real runtime
- the root cause was not those commands individually
- the root cause was that each CLI invocation created a fresh adapter without rehydrating the live session state

That is a system-level discovery, not a feature-level bug fix.

### 2. The loop already looks like operational learning

The work naturally converged on this loop:

- reproduce
- debug
- fix
- verify
- learn

That loop matters because it is the foundation for future NOOA capabilities in:

- dogfooding
- Ralph
- replay
- automated investigation

The system is beginning to learn from runtime evidence rather than only from source inspection.

### 3. Session boundary is the real problem

The most important failure was initially easy to misread as an `eval` problem.

It was actually a session architecture problem:

- a persisted session record existed
- the target process was still alive
- the new CLI command had no live transport bound to that session

This forced an explicit separation between three states:

1. persisted session record
2. live debug transport
3. paused runtime snapshot

That separation is not optional for debug. It is the center of the design.

### 4. NOOA is validating a strong pattern: short CLI commands over long-lived processes

`nooa debug` already behaves like this:

- the CLI command is short-lived
- the target process is long-lived
- the session record persists across commands
- each invocation reconnects and operates on the same target

That pattern is larger than debug. It is a reusable operating model for:

- browser automation
- agent sessions
- replay systems
- profiling
- background daemons

This is one of the strongest architectural signals to come out of the work so far.

### 5. Real runtimes are a better truth source than fake adapters

The fake adapters were useful for TDD and contract shaping.

But the real runtime exposed the actual hard problems:

- reconnecting is not the same as being paused
- `Debugger.paused` does not necessarily reappear the way a naive design expects
- `eval` depends on a live call frame, not persisted metadata
- `vars` can fail because the orchestration consumed the useful paused state in the wrong order

This is exactly why runtime-backed integration testing must stay first-class in the feature.

## Strategic Reading

The strategic lesson is not "we are adding a debug command".

The strategic lesson is:

- NOOA is moving from toolbox toward operating system
- runtime lifecycle is becoming a first-class concern
- capabilities are starting to replace purely textual process guidance

That shift shows up in the current design vocabulary:

- session
- runtime
- adapter
- transport
- lifecycle
- dogfooding
- replay

This is the language of a platform, not just a CLI command collection.

## Important Smells Discovered

### Dynamic command loading is still too fragile

During dogfooding, every invocation emitted:

- `Error loading command from demo`

That is not part of `debug`, but it is still an important architectural smell. It suggests the command-loading path is vulnerable to partially present or missing features in the repository.

That fragility matters because it contaminates runtime behavior and can mislead dogfooding results.

### Persisted state is necessary but insufficient

Saving `.nooa/debug/sessions.json` was necessary.

It was not enough.

The runtime truth lives in the composition of:

- target process
- inspector transport
- current paused frame
- persisted session metadata

Any future long-lived capability in NOOA should assume this pattern early rather than discovering it late.

## Current Architectural Priority

The most important discovered constraint is this:

- each CLI command starts from a cold process
- but the debug target and its transport state are warm

So the next architectural priority is not richer subcommands. It is session rehydration.

Priority order:

1. real attach/rehydrate from persisted session
2. explicit distinction between session record, live transport, and paused snapshot
3. reconnect integration tests for paused sessions
4. only after that, deepen stepping and richer inspection

## What This Means For Dogfooding and Ralph

If this pattern becomes solid, `nooa debug` stops being just a local feature and becomes a backend capability for:

- dogfood-driven investigation
- Ralph run loops
- replay-backed analysis
- fix flows grounded in runtime evidence

That is the reason to take the session model seriously now. If the session lifecycle is correct, the rest of the system can build on it.

## Bottom Line

The most important outcome so far is not that `nooa debug` exists.

It is that the implementation work already exposed where the architectural truth lives:

- not in the CLI command alone
- not in the test double alone
- not in the persisted file alone

It lives in the interaction between persistent records, live transports, and runtime state.

That is the emergence worth preserving.
