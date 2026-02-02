# MCP Alias Shortcuts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist MCP alias shortcuts so users can register custom shortcuts once and invoke them via `nooa <alias>`.

**Architecture:** Add a dedicated SQLite table for alias metadata, expose CRUD commands under `nooa mcp alias`, and route the CLI dispatcher through the alias registry before falling back to normal subcommands. Alias execution will rely on the existing `v1.3` registry/CLI surface and simply rehydrate stored args once triggered.

**Tech Stack:** Bun + TypeScript, `bun:sqlite`, `bun:test`, `parseArgs` for CLI, docs under `docs/commands/mcp.md`, tests inside `src/features/mcp/alias.test.ts`.

### Task 1: Alias persistence schema + store helpers

**Files:**
- Create: `src/core/db/schema/mcp_aliases.ts`
- Modify: `src/core/mcp/ConfigStore.ts` (optional helper) and `src/core/mcp/Registry.ts` (expose alias store)
- Test: `src/core/mcp/alias.test.ts`

**Step 1: Write failing test**
```ts
import { Database } from "bun:sqlite";
import { createTempMcpDb } from "../features/mcp/test-utils";
import { Registry } from "./Registry";

test("aliases persist and return metadata", async () => {
  const { dbPath } = await createTempMcpDb();
  const db = new Database(dbPath);
  const registry = new Registry(db);
  await registry.aliasCreate("deploy", "mcp", ["call", "deploy"], { foo: "bar" });
  const alias = await registry.getAlias("deploy");
  expect(alias).toMatchObject({ name: "deploy", args: ["call", "deploy"], options: { foo: "bar" } });
});
```
Expected: fails because alias helpers not implemented.

**Step 2: Run test to confirm fail**
```
bun test src/core/mcp/alias.test.ts
```
Expect: fail (command/method undefined).

**Step 3: Implement minimal code**
- Create schema file with `CREATE TABLE IF NOT EXISTS mcp_aliases (name TEXT PRIMARY KEY, command TEXT NOT NULL, args TEXT, env TEXT)` etc.
- Add alias store helper, used by `Registry` to save/retrieve alias metadata.
- Provide TTL + default values? (just store commands + args + metadata)

**Step 4: Run test**
```
bun test src/core/mcp/alias.test.ts
```
Expect: pass.

**Step 5: Commit**
```
git add src/core/db/schema/mcp_aliases.ts src/core/mcp/*.ts src/core/mcp/alias.test.ts
    docs/plans/2026-02-05-mcp-alias-shortcuts.md
git commit -m "feat: add MCP alias persistence"
```

### Task 2: CLI commands for alias CRUD

**Files:**
- Create: `src/features/mcp/alias.ts`, `src/features/mcp/alias.test.ts`
- Modify: `src/features/mcp/cli.ts`, `docs/commands/mcp.md`

**Step 1: Write failing CLI test**
```
bun test src/features/mcp/alias.test.ts
```
Expect: fail because command not implemented.

**Step 2: Implement `mcp alias` subcommands**
- Add `alias create <name> --command <cmd> --args <arg>... --env KEY=VAL` that stores alias.
- Add `alias list` and `alias delete <name>` for management.
- Tests should assert JSON output, help text, and persistence via registry alias helpers.

**Step 3: Update docs**
- Document `nooa mcp alias create`, `list`, `delete`, show env flag usage.

**Step 4: Run tests**
```
bun test src/features/mcp/alias.test.ts
```
Expect: pass.

**Step 5: Commit**
```
git add src/features/mcp/alias.ts docs/commands/mcp.md src/features/mcp/alias.test.ts
git commit -m "feat: add MCP alias CLI"
```

### Task 3: CLI alias execution and dogfooding

**Files:**
- Modify: `src/core/registry.ts`, `index.ts`, `docs/commands/mcp.md`

**Step 1: Write failing integration test**
- Add `tests/features/alias/cli.test.ts` that registers an alias and invokes `bun index.ts deploy`. Expect alias runs registered command (e.g., `mcp call`).

**Step 2: Implement alias lookup in `index.ts`**
- Before default subcommand dispatch, ask registry for alias matching `positionals[0]`; if found, rerun CLI with stored args.

**Step 3: Dogfood**
- Run `nooa` with a test alias (create via CLI in worktree), ensure it executes the stored MCP command.
- Document result in plan.

**Step 4: Run targeted tests & full suite**
```
bun test src/features/mcp/alias.test.ts tests/features/alias/cli.test.ts
bun test --coverage
bun check && bun lint
```
Expect: green.

**Step 5: Commit**
```
git add index.ts src/core/registry.ts docs/commands/mcp.md tests/features/alias/cli.test.ts
git commit -m "feat: hydrate MCP alias execution"
```

Plan complete and saved to `docs/plans/2026-02-05-mcp-alias-shortcuts.md`. Two execution options:

1. **Subagent-Driven (this session)** – Stay here, use `superpowers:subagent-driven-development`, tackle each task sequentially with check-ins.
2. **Parallel Session (separate)** – Start new session using `superpowers:executing-plans` to run tasks and report back.

Which approach should I take? EOF