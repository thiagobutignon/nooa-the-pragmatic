# MCP Health + Retry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a resident health-check workflow and robust retry/backoff controls to MCP operations so agents can verify servers before they call tools and recover from transient failures.

**Architecture:** Extend the Registry to expose a typed `healthCheck` that spins up the MCP client, pings the tool, records latency, and returns a healthfingerprint; expose the same verdict through a new `nooa mcp health` CLI that reports structured output. Enhance the MCP client caller so tool invocations retry with exponential backoff and configurable timeouts, and wire the CLI `call` flags to those options.

**Tech Stack:** Bun + TypeScript, SQLite-backed MCP registry, built-in `node:child_process` client, Bun test suite for feature/CLI tests, docs under `docs/commands/mcp.md`.

### Task 1: Registry health-check

**Files:**
- Modify: `src/core/mcp/types.ts`
- Modify: `src/core/mcp/Registry.ts`
- Create: `src/core/mcp/Registry.test.ts`

**Step 1:** Write a new test file that seeds the mock MCP server, instantiates `Registry`, and calls the future `healthCheck` API twice (one healthy server, one disabled/missing) expecting structured status objects. Keep the test focused on the API contract, not the CLI.

**Step 2:** Run `bun test src/core/mcp/Registry.test.ts` and confirm it fails because `healthCheck` and `HealthStatus` do not exist yet.

**Step 3:** Implement `HealthStatus` in the types file and add `Registry.healthCheck(name)` that starts a `ServerManager`, pings the server, measures latency, and returns the proper union (`healthy`/`degraded`/`down`). Include defaults for missing server or disabled state.

**Step 4:** Run the same test again until it passes.

### Task 2: `nooa mcp health` CLI and docs

**Files:**
- Add: `src/features/mcp/health.ts`
- Modify: `src/features/mcp/cli.ts`
- Modify: `docs/commands/mcp.md`
- Modify: `src/features/mcp/test.ts` and/or add a new CLI test (`src/features/mcp/health.test.ts`)

**Step 1:** Write the CLI test(s) for the new subcommand: one asserting JSON output when the mock server is healthy, one asserting a readable error when the server is disabled and `--json` is absent.

**Step 2:** Run `bun test src/features/mcp/health.test.ts` and verify it fails due to the missing command.

**Step 3:** Implement `health.ts` to parse `<name>` + `--json`, call `registry.healthCheck`, and print either prettified text or the JSON structure from Task 1. Update `cli.ts` to import and dispatch this subcommand plus list it in the help block.

**Step 4:** Update `docs/commands/mcp.md` to mention `nooa mcp health <name>` usage, explain statuses, and describe available flags.

**Step 5:** Re-run the targeted health test(s) to confirm they now pass.

### Task 3: Retry/backoff in `call` command

**Files:**
- Modify: `src/core/mcp/Client.ts`
- Modify: `src/features/mcp/call.ts`
- Modify: `src/features/mcp/call.test.ts`
- Modify: `docs/commands/mcp.md`

**Step 1:** Write/extend `src/core/mcp/Client.test.ts` that instantiates a test subclass of `Client`, simulates transient failures by overriding `sendRequest`, and asserts that `callTool` retries before finally succeeding or throwing for too many failures.

**Step 2:** Run `bun test src/core/mcp/Client.test.ts` expecting failure because `callTool` lacks retry/backoff.

**Step 3:** Implement configurable `CallOptions` on `Client.callTool`, add exponential backoff delays, and allow passing `timeoutMs` down to `sendRequest`. Ensure errors are rethrown after exhausting retries.

**Step 4:** Update `call.ts` to accept `--retries`, `--timeout`, and `--backoff` flags, pass them into `callTool`, and document these options in `docs/commands/mcp.md`. Enhance the CLI test to include the new flags, verifying the command still succeeds with the mock server.

**Step 5:** Re-run `bun test src/core/mcp/Client.test.ts src/features/mcp/call.test.ts` until they succeed.

### Final verification

**Step 1:** Run `bun check`, `bun lint`, and `bun test --coverage` to make sure the project is still healthy.

**Step 2:** Record results and prepare to merge from the worktree.
