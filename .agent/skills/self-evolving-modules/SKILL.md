---
name: self-evolving-modules
description: Use when creating new NOOA CLI features, commands, or refactoring existing ones to match the self-describing standard (Single Source of Truth).
---

# Self-Evolving Modules

## Overview

A **self-evolving module** defines a command's specification (inputs, outputs, errors, examples) in a single **Schema-Driven** source of truth.

**Core Principle:** Define once in code/schema, generate everything else (CLI help, Agent Tool Specs, SDK types, Documentation) automatically. This guarantees zero drift between what the code *does* and what the documentation *says*.

## Quick Start (TL;DR)

**Creating a new command in 60 seconds:**

1. Copy template: `cp src/features/_template/cli.ts src/features/myfeature/cli.ts` (or copy the example below)
2. Replace placeholders: `myfeature`, `MyFeature`, etc.
3. Implement `run()` function
4. Update schema with your flags
5. Export `myfeatureAgentDoc` and `myfeatureFeatureDoc`
6. Test: `nooa myfeature --help`

Done! ✅

## Required Reading

Before implementing or modifying any module, **YOU MUST READ** the following references located in `references/`:

1. `self-evolving-cli-modules.md`: The research report explaining the "Why" and "What".
2. `implementation-archetypes.md`: The 5 core patterns (we use Archetype 2/Command Builder).
3. `implementation-roadmap.md`: The strategic plan.

**Why is this mandatory?** These documents contain the architectural decisions, trade-offs, and "Iron Laws" of our system. Skipping them leads to drift and technical debt.

## When to Use

- Creating **ANY** new CLI command in NOOA.
- Refactoring legacy commands.
- When you need a feature accessible via CLI, SDK, and AI Agents simultaneously.

**Do NOT use for:**
- Internal helper functions (unless they need to be exposed as tools).
- One-off scripts not part of the main CLI.

## Decision Guide

### Should This Be One Command or Multiple?

**One Command When:**
- Single clear responsibility
- Flags modify behavior slightly
- Example: `read <path> [--json] [--streaming]`

**Multiple Commands When:**
- Different verbs/actions
- Different input/output shapes
- Example: `user create`, `user delete`, `user list`

### Should I Use Subcommands?

**YES if:**
- You are grouping related operations under a namespace.
- Example: `nooa db migrate`, `nooa db seed`

**NO if:**
- Top-level verbs are clearer and unique.
- Example: `nooa read file.txt`, `nooa write file.txt data`

### Complex Validation: Where Does It Go?

**Simple validation:** In `run()` function
```typescript
if (!input.email?.includes('@')) {
    return { ok: false, error: sdkError(...) };
}
```

**Complex validation:** Separate validator
Create a validator file (e.g., `validators/email.ts`) and call it from `run()`.

## Core Pattern: The Command Builder

We use the **Builder DSL** pattern (Archetype 2) implemented via `CommandBuilder`.

One file (`src/features/<feature>/cli.ts`) contains everything: Metadata, Schema, Logic, and Builder.

## Complete Working Example

```typescript
// src/features/greet/cli.ts
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult, type AgentDocMeta } from "../../core/types";

// 1. METADATA
export const greetMeta: AgentDocMeta = {
    name: "greet",
    description: "Greet a user by name",
    changelog: [
        { version: "1.1.0", changes: ["Added --uppercase flag"] },
        { version: "1.0.0", changes: ["Initial release"] },
    ],
};

// 2. HELP TEXT
export const greetHelp = `
Usage: nooa greet <name> [flags]

Greet a user by name.

Arguments:
  <name>      Name of the person to greet.

Flags:
  --uppercase     Convert greeting to uppercase.
  -h, --help      Show help message.

Examples:
  nooa greet Alice
  nooa greet Bob --uppercase

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error (missing name)
`;

// 3. SCHEMA
export const greetSchema = {
    name: { type: "string", required: true },
    uppercase: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

// 4. TYPES
export interface GreetRunInput {
    name?: string;
    uppercase?: boolean;
}

export interface GreetRunResult {
    ok: boolean;
    traceId: string;
    message: string;
}

// 5. BUSINESS LOGIC (Pure Function)
export async function run(
    input: GreetRunInput
): Promise<SdkResult<GreetRunResult>> {
    const traceId = createTraceId();

    // Validation
    if (!input.name) {
        return {
            ok: false,
            error: sdkError("greet.missing_name", "Name is required."),
        };
    }

    // Business Logic
    let message = `Hello, ${input.name}!`;
    if (input.uppercase) {
        message = message.toUpperCase();
    }

    // Success Response
    return {
        ok: true,
        data: {
            ok: true,
            traceId,
            message,
        },
    };
}

// 6. COMMAND BUILDER
const greetBuilder = new CommandBuilder<GreetRunInput, GreetRunResult>()
    .meta(greetMeta)
    .schema(greetSchema)
    .help(greetHelp)
    .options({ options: buildStandardOptions() })
    .parseInput(async ({ positionals, values }) => ({
        name: positionals[1],
        uppercase: Boolean(values.uppercase),
    }))
    .run(run)
    .onFailure((error, input) => {
        console.error(`Error: ${error.message}`);
        process.exitCode = error.code === "greet.missing_name" ? 2 : 1;
    })
    .onSuccess((output) => {
        console.log(output.message);
    })
    .telemetry({
        eventPrefix: "greet",
        successMetadata: (input, output) => ({
            name: input.name,
            uppercase: input.uppercase,
        }),
        failureMetadata: (input, error) => ({
            name: input.name,
            error: error.message,
        }),
    });

// 7. EXPORTS (Critical!)
export const greetAgentDoc = greetBuilder.buildAgentDoc(false);
export const greetFeatureDoc = (includeChangelog: boolean) =>
    greetBuilder.buildFeatureDoc(includeChangelog);

const greetCommand = greetBuilder.build();
export default greetCommand;
```

## Error Code Naming Convention

Format: `<feature>.<category>_<detail>`

**Categories:**
- `missing_*`: Required input not provided
- `invalid_*`: Input provided but wrong format
- `not_found`: Resource doesn't exist
- `permission_denied`: Access forbidden
- `*_failed`: Operation attempted but failed

**Examples:**
- ✅ `read.missing_path`
- ✅ `read.not_found`
- ✅ `read.file_too_large`
- ❌ `read.error` (Too vague)
- ❌ `readMissingPath` (Wrong format)

## Testing Your Module

### Unit Tests (Business Logic)
Test the `run()` function directly:

```typescript
import { run } from './cli';

describe('greet.run()', () => {
    it('should greet by name', async () => {
        const result = await run({ name: 'Alice' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.message).toBe('Hello, Alice!');
        }
    });

    it('should return error when name missing', async () => {
        const result = await run({});
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('greet.missing_name');
        }
    });
});
```

### Integration Tests (CLI)
Test the full command:

```typescript
import { execSync } from 'child_process';

describe('nooa greet', () => {
    it('should work via CLI', () => {
        const output = execSync('nooa greet Alice').toString();
        expect(output).toContain('Hello, Alice!');
    });
});
```

### Agent Doc Tests
Verify agent documentation is valid:

```typescript
import { greetAgentDoc } from './cli';

describe('greet agent doc', () => {
    it('should have required fields', () => {
        expect(greetAgentDoc.name).toBe('greet');
        expect(greetAgentDoc.description).toBeTruthy();
        expect(greetAgentDoc.schema).toBeDefined();
    });
});
```

## Performance Best Practices

1. **Lazy Load Heavy Dependencies:**
   Use dynamic `import()` inside `parseInput` or `run` for libraries that are large and not always needed.

2. **Cache Expensive Operations:**
   Store results of expensive calls (like config loading) in a module-level variable if safe.

3. **Stream Large Data:**
   Use Node.js streams for file/network I/O to avoid memory spikes.

## Migrating Legacy Commands

1. **Create new structure:** `touch src/features/old-cmd/cli.ts`
2. **Extract business logic:** Move file/API ops to `run()` function.
3. **Define schema:** Map old `args`/`flags` usage to `readSchema`.
4. **Map inputs:** Use `parseInput` to translate CLI args to the new Input type.
5. **Test side-by-side:** Run legacy and new commands to verify identical behavior.
6. **Swap:** Replace the legacy export with the new one.

## Troubleshooting

### "Agent can't see my command"
- **Cause:** Missing `buildAgentDoc()` export.
- **Fix:** Ensure you export `const <cmd>AgentDoc`.

### "Help text doesn't match behavior"
- **Cause:** Help string is stale.
- **Fix:** Update the `help` string in `cli.ts`. It's the source.

### "Type errors in builder chain"
- **Cause:** `CommandBuilder<Input, Output>` generic types don't match the interfaces used in `run()`.
- **Fix:** Double check `interface` definitions match the generic parameters.

### "Telemetry not showing up"
- **Cause:** Missing `.telemetry()` configuration.
- **Fix:** Add the telemetry block to the builder.

## Implementation Checklist

- [ ] **File Location**: `src/features/<feature>/cli.ts`
- [ ] **Imports**: `CommandBuilder`, types from `../../core`
- [ ] **Meta**: Name, description, changelog defined.
- [ ] **Schema**: All inputs typed.
- [ ] **Usage specs**: `cli` usage strings defined.
- [ ] **Errors**: Error codes follow naming convention.
- [ ] **Telemetry**: configured.
- [ ] **Run Function**: Pure, returns `SdkResult`.
- [ ] **Builder**: Configured with all parts.
- [ ] **Exports**: `command` (default), `*AgentDoc`, `*FeatureDoc`.

## Common Mistakes

### 1. Hardcoding CLI Logic in `run()`
**Bad:** Calling `console.log` inside `run()`.
**Fix:** `run()` should be pure. return data. Use `.onSuccess()` in builder for logging to stdout.

### 2. Drifting Help Text
**Bad:** Manually updating `docs/` but not the code string.
**Fix:** The code string passed to `.help()` IS the source. Docs are generated from it.
