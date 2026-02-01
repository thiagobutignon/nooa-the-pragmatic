# Phase A: Soul Primitives (Bootstrap & Identity) - REFINED

Initialize NOOA's core personality and identity files with a conversational bootstrap ritual and a strict, budget-aware injection precedence.

## 1. Objective
Achieve "Agentic Grounding" by ensuring every **AI-driven execution** receives a consistent, sanitized context (Constitution → Soul → User → Memory). This establishes personality without sacrificing security or performance.

## 2. Proposed Changes

### [NEW] `src/features/init/` (CLI & Logic)
- **`nooa init`**: Conversational & deterministic bootstrap.
  - **Defaults**: name: `NOOA`, vibe: `resourceful`, creature: `protocol droid`.
  - **Structure**: Creates `.nooa/` at `--root` (default: repo root).
  - **Files Generated**:
    - `.nooa/CONSTITUTION.md`: **Immutable** core principles (No TODOs, fail fast, evidence-based).
    - `.nooa/IDENTITY.md`: Basic metadata (Name, Emoji, Avatar).
    - `.nooa/SOUL.md`: Behavioral logic with `## LOCKED` and `## MUTABLE` sections.
    - `.nooa/USER.md`: Team-level user profile.
    - `.nooa/USER.local.md`: Personal preferences (added to `.nooa/.gitignore`).
- **CLI Contract**:
  - Flags: `--name`, `--vibe`, `--non-interactive`, `--force`, `--root`, `--json`, `--out`.
  - Exit Codes: `0` (Success), `1` (Runtime Error), `2` (Validation Error).
  - Telemetry: `init.success|failure` with `{ non_interactive, files_written }`.

### [MODIFY] `src/features/prompt/engine.ts`
- **Context Injection Loop**:
  - **Precedence**: Constitution (8KB) → SOUL (16KB) → USER (8KB) → (Memory Optional) → Task.
  - **Total Budget**: Max 32KB for total injected context.
  - **Sanitization**: Wrap untrusted layers (USER/MEMORY) in `BEGIN_UNTRUSTED_CONTEXT` / `END_UNTRUSTED_CONTEXT` blocks.
  - **Metadata**: Export `injectionMeta` (order, bytes per layer, truncation status).

## 3. Verification Plan

### Automated Tests
- **Contract Test**: `nooa init --json` validates schema and exit codes.
- **Overwrite Policy**: Verify `nooa init` fails without `--force` if `.nooa/` exists.
- **Budget Test**: Create an oversized `SOUL.md` and verify `injectionMeta.truncated === true`.
- **Precedence Test**: Official `nooa prompt render <name> --debug-injection --json` asserts the exact layer order.

### Dogfooding
- Run `nooa init` in the current repo and verify that subsequent AI turns (e.g., `nooa review`) acknowledge the new identity.
