# MCP Optional Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the remaining optional MCP enhancements (init wizard, marketplace, env file, alias shortcuts, and cached schemas) in a dedicated worktree.

**Architecture:** Build on top of the existing SQLite-backed registry/CLI. Each feature introduces focused persistence changes (new tables or env file parsing) plus CLI surface updates. Reuse shared helpers (`Registry`, `ConfigStore`, `ServerManager`) while keeping tests per feature.

**Tech Stack:** Bun + TypeScript, `bun:test` for tests, SQLite via `bun:sqlite`, CLI parsing with `node:util`/`parseArgs`, docs under `docs/commands/mcp.md`.

### Task 1: `nooa mcp init` onboarding wizard

**Files:**
- Create: `src/features/mcp/init.ts`
- Modify: `src/features/mcp/cli.ts`, `docs/commands/mcp.md`
- Test: `src/features/mcp/init.test.ts`

**Step 1:** Write a test that runs `initCommand` (with mocked registry) and asserts recommended MCPs are installed and GitHub token prompt branches work.
**Step 2:** Run `bun test src/features/mcp/init.test.ts` → expect failure until command exists.
**Step 3:** Implement CLI `init` that prompts interactively (fallback to defaults in tests), installs recommended MCP names, and optionally configures GitHub token/env. Include non-interactive flags for automation.
**Step 4:** Update `docs/commands/mcp.md` to describe `nooa mcp init` usage.
**Step 5:** Re-run test until green.

### Task 2: `nooa mcp marketplace` search/discovery

**Files:**
- Create: `src/features/mcp/marketplace.ts`
- Modify: `src/features/mcp/cli.ts`, `docs/commands/mcp.md`
- Test: `src/features/mcp/marketplace.test.ts`

**Step 1:** Write tests that stub `fetch` (or a helper) and assert CLI `marketplace` returns curated entries with `--verified-only` and `--json` flags.
**Step 2:** Run `bun test src/features/mcp/marketplace.test.ts` → fail.
**Step 3:** Implement marketplace command that queries npm search + curated JSON (mockable), allows filters, paginates/respects `--verified-only`, `--query`, `--json`.
**Step 4:** Update docs to describe `nooa mcp marketplace` flags.
**Step 5:** Re-run targeted test until pass.

### Task 3: Environment file support for `mcp configure`

**Files:**
- Modify: `src/features/mcp/configure.ts`, `src/features/mcp/configure.test.ts`, `docs/commands/mcp.md`

**Step 1:** Extend tests to cover `--env-file` reading a `.mcp.env` file (simulate contents). Ensure errors surface when file missing.
**Step 2:** Run `bun test src/features/mcp/configure.test.ts` → fail to prompt implementation.
**Step 3:** Update `configure.ts` to parse env files (`KEY=VALUE`), merge into existing env map, and persist via `Registry`. Add helper to read `.mcp.env` optionally in CLI as fallback.
**Step 4:** Document `--env-file` usage.
**Step 5:** Re-run tests.

### Task 4: Alias shortcuts persisted in SQLite

**Files:**
- Create: `src/core/mcp/alias.ts`, `src/features/mcp/alias.ts`, `src/features/mcp/alias.test.ts`
- Modify: `src/core/db/schema/mcp_aliases.ts`, `docs/commands/mcp.md`, `index.ts` (lookup alias), `src/core/registry.ts` (add alias helper)

**Step 1:** Add schema + store helpers to register/lookup aliases (name → command string). Write tests ensuring alias creation/reuse works (including executing alias via `index.ts` hooking to CLI). Run alias tests to fail.
**Step 2:** Implement CLI `mcp alias create`/`list` (maybe also `delete`) and integrate `index.ts` to detect alias names before command dispatch.
**Step 3:** Document new alias command and usage (including running alias from root CLI).
**Step 4:** Run alias tests & root `bun test` coverage for alias flow.

### Task 5: MCP tool schema caching (TTL 24h)

**Files:**
- Create: `src/core/db/schema/mcp_tool_cache.ts`
- Modify: `src/core/mcp/ConfigStore.ts`, `src/core/mcp/Registry.ts`, `src/core/mcp/Client.ts`, `src/features/mcp/call.ts`, `docs/commands/mcp.md`
- Test: `src/core/mcp/cache.test.ts`, `src/features/mcp/call.test.ts` (extend to ensure caching reused)

**Step 1:** Add DB schema + store methods to cache tool schemas, including TTL logic. Test storing and retrieving with TTL.
**Step 2:** Update `Client`/`Registry` to query cached schema before listing tools/start. Use TTL of 24h.
**Step 3:** Ensure `call` command uses cached schema when available to avoid extra `listTools` call; test `call` to assert schema reuses (mocking client). Document caching behavior.
**Step 4:** Run added tests until green.

### Final Validation

**Step 1:** Run `bun check`, `bun lint` (if separate), and `bun test --coverage` within the worktree to make sure everything passes.
**Step 2:** Report results and prepare for merge.
