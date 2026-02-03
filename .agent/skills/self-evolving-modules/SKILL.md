---
name: self-evolving-modules
description: Use when creating new NOOA CLI features, commands, or refactoring existing ones to match the self-describing standard (Single Source of Truth).
---

# Self-Evolving Modules

## Overview

A **self-evolving module** defines a command's specification (inputs, outputs, errors, examples) in a single **Schema-Driven** source of truth.

**Core Principle:** Define once in code/schema, generate everything else (CLI help, Agent Tool Specs, SDK types, Documentation) automatically. This guarantees zero drift between what the code *does* and what the documentation *says*.

## When to Use

- Creating **ANY** new CLI command in NOOA.
- Refactoring legacy commands.
- When you need a feature accessible via CLI, SDK, and AI Agents simultaneously.

**Do NOT use for:**
- Internal helper functions (unless they need to be exposed as tools).
- One-off scripts not part of the main CLI.

## Core Pattern: The Command Builder

We use the **Builder DSL** pattern (Archetype 2) implemented via `CommandBuilder`.

### Before (Legacy/Bad)
- `index.ts` handles generic CLI parsing.
- `types.ts` has interfaces.
- `README.md` has manually written help text (likely outdated).
- No standard way for agents to know how to call it.

### After (Self-Describing)
One file (`src/features/<feature>/cli.ts`) contains everything.

```typescript
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { z } from "zod"; // Logic often uses Zod internally, or simple parsing

// 1. Define Metadata (Identity & History)
export const readMeta = {
    name: "read",
    description: "Read file contents",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

// 2. Define Usage & Help (Human Interface)
export const readHelp = `Usage: nooa read <path>...`;

// 3. Define Schema (Machine Interface)
export const readSchema = {
    path: { type: "string", required: true },
    json: { type: "boolean", default: false },
} satisfies SchemaSpec;

// 4. Define Implementation (The Logic)
// MUST return SdkResult<T>
async function run(input: ReadInput): Promise<SdkResult<ReadResult>> {
    // ... implementation ...
}

// 5. Build & Export
const builder = new CommandBuilder<ReadInput, ReadResult>()
    .meta(readMeta)
    .schema(readSchema)
    .help(readHelp)
    .run(run)
    // ... bindings ...
    .build();

export default builder;
```

## Quick Reference

| Component | Purpose | Location |
|-----------|---------|----------|
| **Meta** | Name, descriptions, versions | `const <name>Meta = ...` |
| **Schema** | Input flags/args definition | `const <name>Schema = ...` |
| **Run Fn** | Pure business logic, returns `SdkResult` | `async function run(...)` |
| **Builder** | Binds it all together | `new CommandBuilder()...build()` |
| **Exports** | used by CLI/SDK/Agent loaders | `default`, `*AgentDoc`, `*FeatureDoc` |

## Implementation Checklist

- [ ] **File Location**: `src/features/<feature>/cli.ts`
- [ ] **Imports**: `CommandBuilder`, types from `../../core`
- [ ] **Meta**: Name, description, changelog defined.
- [ ] **Schema**: All inputs typed (`string`, `number`, `boolean`).
- [ ] **Usage specs**: `cli`, `sdk` usage strings defined.
- [ ] **Examples**: strictly typed examples of input/output provided.
- [ ] **Errors**: Known error codes enumerated (`<feature>.<error_code>`).
- [ ] **Telemetry**: `successMetadata` and `failureMetadata` configured.
- [ ] **Run Function**:
    - Returns `Promise<SdkResult<Output>>`
    - Handles exceptions and returns structured `error` (not throws).
- [ ] **Builder**:
    - `.parseInput()` handles stdin/positional mapping.
    - `.onSuccess()`/`.onFailure()` handle CLI printing (console.log/error).
- [ ] **Exports**: `command` (default), `*AgentDoc`, `*FeatureDoc`.

## Common Mistakes

### 1. Hardcoding CLI Logic in `run()`
**Bad:** Calling `console.log` inside `run()`.
**Fix:** `run()` should be pure. return data. Use `.onSuccess()` in builder for logging to stdout.

### 2. Missing Agent Docs
**Bad:** Forgetting `.buildAgentDoc()`.
**Fix:** Agents won't "see" your tool without it. Always export `*AgentDoc`.

### 3. Drifting Help Text
**Bad:** Manually updating `docs/` but not the code string.
**Fix:** The code string passed to `.help()` IS the source. Docs are generated from it.

### 4. Ignoring Telemetry
**Bad:** No `.telemetry()` config.
**Fix:** We need observability. Map input/output fields to telemetry events.

## Real-World Impact

Modules built this way automatically appear in:
1. `nooa <command> --help`
2. The Agent's tool definition (allowing it to use the command autonomously).
3. The generated Reference Documentation.
4. The SDK export for programmatic use (`import { run } from ...`).

## Example (Full Template)

See `src/features/read/cli.ts` for the canonical example.
