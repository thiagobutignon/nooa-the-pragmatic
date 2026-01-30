# Dynamic CLI Architecture Implementation Plan

**Status:** Implemented (with telemetry + structured logging integrated after rollout)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the CLI to use a dynamic command registry that loads commands from feature modules, eliminating the monolithic dispatch logic in `index.ts`.

**Architecture:**
- **Command Interface:** Defines the contract for all CLI commands (`name`, `description`, `execute`, `help`).
- **Command Registry:** Dynamically loads or registers commands from `src/features/*/cli.ts`.
- **Atomic Features:** Each feature exports its CLI definition, making the system extensible by adding files.
- **Entry point:** `index.ts` becomes a thin wrapper around the Registry.
 - **Telemetry + Logger:** Core structured logging and persistent telemetry are now part of the command runtime.

**Tech Stack:** TypeScript, Bun, `node:util` (parseArgs).

---

### Task 1: Define Command Interface & Registry

**Files:**
- Create: `src/core/command.ts`
- Create: `src/core/registry.ts`
- Test: `src/core/registry.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/registry.test.ts
import { describe, expect, test, mock } from "bun:test";
import { CommandRegistry } from "./registry";
import type { Command } from "./command";

describe("CommandRegistry", () => {
    test("registers and retrieves a command", () => {
        const registry = new CommandRegistry();
        const cmd: Command = {
            name: "test-cmd",
            description: "A test command",
            execute: async () => {},
        };

        registry.register(cmd);
        expect(registry.get("test-cmd")).toBe(cmd);
    });

    test("lists registered commands", () => {
        const registry = new CommandRegistry();
        registry.register({ name: "a", description: "desc a", execute: async () => {} });
        registry.register({ name: "b", description: "desc b", execute: async () => {} });

        const list = registry.list();
        expect(list).toHaveLength(2);
        expect(list.map(c => c.name)).toEqual(["a", "b"]);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/registry.test.ts`
Expected: FAIL (modules not found)

**Step 3: Write minimal implementation**

```typescript
// src/core/command.ts
import type { EventBus } from "./event-bus";

export interface CommandContext {
    args: string[];
    values: Record<string, unknown>;
    bus: EventBus;
}

export interface Command {
    name: string;
    description: string;
    execute: (context: CommandContext) => Promise<void>;
}
```

```typescript
// src/core/registry.ts
import type { Command } from "./command";

export class CommandRegistry {
    private commands = new Map<string, Command>();

    register(command: Command) {
        this.commands.set(command.name, command);
    }

    get(name: string): Command | undefined {
        return this.commands.get(name);
    }

    list(): Command[] {
        return Array.from(this.commands.values());
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/command.ts src/core/registry.ts src/core/registry.test.ts
git commit -m "feat: core command registry and interface"
```

**Status:** ✅ Done (registry + interface implemented)

---

### Task 2: Implement Dynamic Loader

**Files:**
- Modify: `src/core/registry.ts`
- Test: `src/core/loader.test.ts` (new)

**Step 1: Write the failing test**

```typescript
// src/core/loader.test.ts
import { describe, expect, test } from "bun:test";
import { loadCommands } from "./registry";
import { join } from "path";

describe("Command Loader", () => {
    test("loads commands from directory", async () => {
        // We will need to mock fs/glob or use a fixture.
        // For simplicity in plan, we assume a fixture path or mock.
        // Failing test: function doesn't exist.
        expect(loadCommands).toBeDefined();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/loader.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/core/registry.ts (append)
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function loadCommands(featuresDir: string): Promise<CommandRegistry> {
    const registry = new CommandRegistry();
    // Simplified logic: strict convention src/features/<name>/cli.ts
    // In production we might use glob.
    const entries = await readdir(featuresDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
            try {
                const cliPath = join(featuresDir, entry.name, "cli.ts");
                const module = await import(cliPath);
                if (module.default && module.default.name) {
                    registry.register(module.default);
                }
            } catch (e) {
                // Ignore missing cli.ts
            }
        }
    }
    return registry;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/loader.test.ts` (update test to actually call it)

**Step 5: Commit**

```bash
git add src/core/registry.ts src/core/loader.test.ts
git commit -m "feat: dynamic command loader"
```

**Status:** ✅ Done (loader + tests implemented)

---

### Task 3: Migrate `read` Command to Definition

**Files:**
- Create: `src/features/read/cmd.ts` (New definition file)
- Modify: `src/features/read/cli.ts` (Adapt or replace)

**Step 1: Write the failing test**

```typescript
// src/features/read/cmd.test.ts
import { describe, expect, test } from "bun:test";
import cmd from "./cmd";

describe("Read Command Definition", () => {
    test("exports valid command", () => {
        expect(cmd.name).toBe("read");
        expect(cmd.description).toContain("Read file");
        expect(typeof cmd.execute).toBe("function");
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/read/cmd.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/features/read/cmd.ts
import type { Command, CommandContext } from "../../core/command";

const readCommand: Command = {
    name: "read",
    description: "Read file contents",
    execute: async ({ args, values, bus }: CommandContext) => {
        // ... Move logic from index.ts / src/features/read/cli.ts here ...
        console.log("Reading...");
    }
};
export default readCommand;
```

**Status:** ✅ Done (read command migrated + tests)

---

### Task 4: Migrate `code` Command to Definition

**Files:**
- Create: `src/features/code/cli.ts` (command definition)
- Test: `src/features/code/cmd.test.ts`

**Status:** ✅ Done (code command exported + tests)

---

### Task 5: Telemetry + Structured Logging (Post-Architecture Upgrade)

**Goal:** Add structured logging and persistent telemetry to all core commands to enable MTTR, performance, and OKR tracking.

**Files:**
- Create: `src/core/logger.ts`, `src/core/logger.test.ts`
- Create: `src/core/telemetry.ts`, `src/core/telemetry.test.ts`
- Modify: `src/features/read/cli.ts`, `src/features/code/cli.ts`
- Add: `.agent/skills/telemetry-observability/*`
- Add: `docs/plans/2026-01-30-telemetry-logging.md`

**Status:** ✅ Done (logger + telemetry store + command instrumentation)

---

### Current Runtime Summary

- `index.ts` uses registry loader to dispatch feature commands.
- `read` and `code` commands emit structured logs to stderr and telemetry to SQLite (`nooa.db`).
- EventBus emits `telemetry.tracked` and command completion events with trace IDs.

**Step 4: Run test to verify it passes**

Run: `bun test src/features/read/cmd.test.ts`

**Step 5: Commit**

```bash
git add src/features/read/cmd.ts src/features/read/cmd.test.ts
git commit -m "refactor(read): migrate to command definition"
```

---

### Task 4: Migrate `code` Command to Definition

(Repeat pattern for `code` command)

---

### Task 5: Wire `index.ts`

**Files:**
- Modify: `index.ts`

**Step 1: Update index.ts to use Registry**

```typescript
// index.ts
import { loadCommands } from "./src/core/registry";
import { join } from "path";

// ...
const registry = await loadCommands(join(import.meta.dir, "src/features"));
const cmd = registry.get(subcommand);

if (cmd) {
    await cmd.execute({ positionals, values, bus });
} else {
   // Show help
}
```

**Step 2: Verify all commands**

Run `bun test` (integration tests should still pass).

**Step 3: Commit**

```bash
git add index.ts
git commit -m "refactor: switch index.ts to dynamic registry"
```
