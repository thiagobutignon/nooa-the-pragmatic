# Cron persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist `nooa cron` jobs in SQLite and expand the CLI/docs so autonomous agents can manage recurring workloads beyond a single session.

**Architecture:** Introduce a `CronStore` backed by the existing SQLite connection, load jobs from `.nooa/cron_jobs.db`, and wire CRUD/update helpers into the CLI command handlers. Commands are routed through the existing registry, each retrieving telemetry and outputting JSON when requested. Command documentation will live in `docs/commands/cron.md`.

**Tech Stack:** Bun/TypeScript CLI, `bun:sqlite` for persistence, `execa` for tests, Biome for lint/format, and the existing `Command`/`EventBus` infrastructure.

### Task 1: Persist cron jobs in SQLite

**Files:**
- Create: `src/core/db/schema/cron_jobs.ts`
- Modify: `src/core/db/index.ts`
- Create: `src/core/db/cron_store.ts`
- Test: `src/core/db/cron_store.test.ts`

**Step 1: Write failing test that asserts `CronStore` creates a table and can insert/select jobs**
```
const store = new CronStore(new Database(":memory:"));
await store.createJob({ name: "foo", schedule: "* * * * *", command: "echo ping" });
const jobs = store.list();
expect(jobs).toContainEqual(expect.objectContaining({ name: "foo" }));
```
**Step 2: Run `bun test src/core/db/cron_store.test.ts` (expected fail).**
**Step 3: Implement schema setup + CronStore (query builder for add/list/remove/update history).**
**Step 4: Re-run the test and expect pass.**
**Step 5: Commit.**

### Task 2: Expand `nooa cron` CLI cases

**Files:**
- Modify: `src/features/cron/cli.ts`
- Create tests: `src/features/cron/cli.test.ts`

**Step 1: Add geo CLI parsing for subcommands (list, remove, enable, disable, run, status, logs, edit, pause/resume, history).**
**Step 2: Write unit tests for each new handler verifying DB persistence (stub CronStore).**
**Step 3: Run `bun test src/features/cron/cli.test.ts` (expected fail) then implement using CronStore.**
**Step 4: Add JSON output options and flags from spec.**
**Step 5: Re-run targeted tests and commit the CLI changes.**

### Task 3: Document cron commands

**Files:**
- Create: `docs/commands/cron.md`

**Step 1: Draft markdown describing each subcommand, flags, and examples from the spec.**
**Step 2: Reference JSON/daemon behavior and storage location `.nooa/cron_jobs.db`.**
**Step 3: Run `npx biome format docs/commands/cron.md`.**
**Step 4: Commit the doc.**

### Task 4: Verify and polish

**Files:**
- Test: Entire suite

**Step 1: Run `bun test`.**
**Step 2: Run `bun check` and `bun run linter`.**
**Step 3: If all succeed, finish (per finishing-a-development-branch skill).**
**Step 4: Commit any remaining adjustments.**

Plan complete and saved to `docs/plans/2026-02-02-cron-persistence.md`. Two execution options:
1. Subagent-Driven (this session)
2. Parallel Session (separate)
Which approach? 
