---
name: refactoring-command-builder
description: Use when refactoring a NOOA CLI feature to the CommandBuilder pattern or when multiple commands share duplicated CLI/SDK/docs/telemetry/exit-code logic
---

# Refactoring CommandBuilder

## Overview

This skill standardizes how to refactor a command into the CommandBuilder pattern so CLI, SDK, agent docs, and feature docs stay aligned. It also forces a **builder expansion audit** on every use to keep duplication out of the codebase as the command surface grows.

**Core principle:** One feature should have **one source of truth** for schema, errors, output, and changelog, with the builder generating consistent CLI/help/docs/agentDoc behavior.

**REQUIRED BACKGROUND:** You MUST understand test-driven-development before using this skill.

## When to Use

Use this skill when any of the following are true:

- You are refactoring a command to CommandBuilder (e.g., `src/features/<feature>/cli.ts`).
- You notice repeated code across commands (help text, parseArgs, JSON rendering, telemetry, exit codes, file writing, docs generation).
- You are adding SDK/TUI/agentDoc outputs and need consistent contracts.
- You are touching `HelpBuilder`, `cli-flags`, or `command-builder` and want to avoid future drift.

## When Not to Use

- One-off scripts that will never be exposed to SDK/TUI/agentDoc.
- Tiny prototypes explicitly marked as throwaway (confirm with human partner).

## Mandatory Workflow (TDD-Style)

### 0) RED: Baseline Failure

Before writing/refactoring any production code:

1. **Pick a pressure scenario** (e.g., “Refactor read command but keep SDK/docs/exit codes aligned”).
2. **Attempt the refactor without this skill** and document what goes wrong.
3. **Record the exact rationalizations and gaps** (e.g., forgot exit code mapping, duplicated docs in multiple files, no builder expansion audit).

If you did not see a failure, you are missing the real failure modes. Stop and re-run a baseline attempt.

### 1) GREEN: Minimal Refactor With CommandBuilder

Refactor with minimal changes required to pass tests and keep behavior consistent.

**Step 1: Inventory current behavior**
- CLI flags: `--json`, `--help`, `--include-changelog`, etc.
- Input source: positionals, stdin fallback, defaults.
- Output: text vs JSON output, output shape.
- Errors: codes, messages, exit codes.
- Telemetry: success/failure events and metadata.
- Docs: CLI help, agentDoc, SDK usage, feature docs.

**Step 2: Move structure into metadata**
- Create/update `AgentDocMeta` with a **changelog array**.
- Keep help text and SDK usage as strings in the feature file (or local sibling) unless already centralized.
- Ensure schema, errors, output fields, exit codes, examples are **data structures** the builder can reuse.

**Step 3: Build the command with CommandBuilder**
- Use `schema(...)`, `usage(...)`, `help(...)`, `errors(...)`, `output(...)`, `examples(...)`, `exitCodes(...)`, `telemetry(...)`.
- Keep `run(...)` as the core business logic; `onSuccess`/`onFailure` should be present only when custom rendering is needed.

**Step 4: Align CLI and docs**
- CLI help should be rendered via builder or `HelpBuilder` using the same schema/errors/exitCodes.
- AgentDoc should include the same schema and errors. Changelog inclusion should be **optional** via flag or builder option.

### 2) REFACTOR: Builder Expansion Audit (Mandatory Every Time)

You MUST perform this audit on every invocation of the skill. If you skip it, the skill failed.

**Goal:** identify repeated logic across commands and **promote it into CommandBuilder or shared helpers**.

**Audit Checklist (scan recent commands):**
- Repeated file writing (e.g., `docs/features`, reports, manifests) → add a builder hook or shared `writeFeatureDocs(...)` helper.
- Repeated `parseArgs` flags → move to `buildStandardOptions()` or builder-level flag toggles.
- Repeated help sections (agentDoc + SDK usage + CLI) → add a builder `buildHelp()`/`buildFeatureDoc()` helper.
- Repeated exit-code mapping or error code sets → centralize in `core/types` and reference by command.
- Repeated JSON rendering vs stdout rendering → builder `onSuccess` default behavior based on schema/output fields.
- Repeated stdin fallback → builder option `withStdinFallback()` or default path inference.
- Repeated telemetry `eventPrefix` and common metadata → builder `telemetry(...)` default behavior.
- Repeated changelog handling → builder `includeChangelogInAgentDoc()` and `withChangelog(...)` defaults.

**Decision rule:** If the same logic exists in **2+ commands**, it should be extracted. If it’s likely to appear in the next command, extract now.

### 3) Verification

**Always verify:**
- Tests for the feature pass (`bun test src/features/<feature>`).
- Help output includes CLI usage, agent instructions, SDK usage.
- Exit codes in docs match the actual behavior.
- `bun run docs` generates `docs/features/<feature>.md` and `.nooa/AGENT_MANIFEST.json` correctly.

## Implementation Pattern (Example)

```ts
// src/features/read/cli.ts
export default new CommandBuilder()
  .meta(readMeta)
  .schema(readSchema)
  .usage(readUsage)
  .help(readHelp)
  .sdkUsage(readSdkUsage)
  .errors(readErrors)
  .output(readOutputFields)
  .examples(readExamples)
  .exitCodes(readExitCodes)
  .telemetry({ eventPrefix: "read" })
  .includeChangelogInAgentDoc(false)
  .run(run)
  .onSuccess(({ output, values }) => values.json ? renderJson(output) : renderText(output))
  .onFailure(({ error }) => mapExitCodes(error))
  .build();
```

**Reference implementation:** `src/features/read/cli.ts`

**Test stability requirement:** current tests must not break. Run the existing feature tests and docs generation to confirm behavior stays consistent:

```bash
bun test src/features/read
bun run docs
```

## Common Mistakes

- **Duplicating docs** (help string in one file, agentDoc in another). Fix: keep one source and render from builder.
- **Mixing rendering with core logic**. Fix: `run()` stays pure; rendering in `onSuccess`.
- **Skipping exit code alignment** with docs. Fix: define `readExitCodes` and reuse in docs/help.
- **No builder expansion audit**. Fix: always run the checklist and extract if repeated.

## Quick Reference

- Put shared types in `src/core/types.ts`.
- Keep `changelog` as an array in meta; builder renders XML/markdown.
- Docs output should be `docs/features/<name>.md` and manifest `.nooa/AGENT_MANIFEST.json`.
- `includeChangelog` must be optional and controlled by flag or builder config.

## Red Flags (Stop and Fix)

- You are copy-pasting `parseArgs` or help blocks across commands.
- CLI behavior does not match docs or agentDoc.
- You skipped the builder expansion audit.
- Tests pass but help or docs are missing sections.

## Real-World Impact

Using this skill consistently:
- Reduces drift across CLI/SDK/TUI surfaces.
- Keeps docs and agent instructions accurate.
- Speeds up adding new commands without regressions.
