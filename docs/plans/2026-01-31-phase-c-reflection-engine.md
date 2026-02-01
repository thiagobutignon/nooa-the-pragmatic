# Phase C: Reflection Engine (Self-Correction Loop)

Enable NOOA to silently reflect on its actions and capture insights without user intervention or performance overhead.

## 1. Objective
Implement a background "Reflection" loop that observes successful development actions and record "Lessons Learned" or "Decisions" into the daily memory.

## 2. Proposed Changes

### [NEW] `src/core/events/MemoryReflector.ts`
- **Subscriber**: Listens to `command.success` events via `EventBus`.
- **Policy**: Only trigger reflection on "Material Changes":
  - `code.patch`, `commit`, `scaffold`, `eval.apply`, `worktree.create`.
- **Limit**: Cap reflections to max 3 entries per execution to prevent noise.

### [NEW] `src/features/memory/reflect.ts`
- **Logic**: Use a specific "Reflection Prompt" to summarize the session's actions into a structured memory entry.
- **Silent Mode**: Ensure `NO_REPLY` is used internally; never output reflection logs to `stdout` (respect `--json`).

## 3. Verification Plan
- **Silent Test**: Run `nooa commit` and verify the daily log is updated without any extra text on screen.
- **Policy Test**: Verify that purely read-only commands (like `search`) do NOT trigger a reflection.
- **Budget Test**: verify that even long sessions don't produce more than the capped amount of memory entries.
