# Plan: NOOA Cron Scheduler (Autonomous Core)

The Cron Scheduler transforms NOOA from a reactive CLI into an autonomous, recurring agent. It handles job scheduling, idempotent execution, and automated reporting.

## Core Pillars

### 1. `nooa cron` CLI Interface
Standardized commands for job management:
- `add <name> --every "15m|1h|daily|weekly" -- <pipeline...>`
- `list`: Show schedules and last run status.
- `run <name>`: Manual execution (dogfooding/debug).
- `remove <name>`: Clean up.
- `logs <name> --tail 50`: Execution history.

### 2. Storage & Governance (SQLite)
Use the existing SQLite infrastructure to track:
- `cron_jobs`: ID, Name, Schedule (Cron string), Pipeline, NextRunAt.
- `cron_runs`: ID, JobID, Status (Running/Success/Failed), StartedAt, FinishedAt, ExitCode, Logs.
- **Locking**: Row-level locking to prevent overlapping executions of the same job.

### 3. Execution Engine
- **`nooa cron tick`**: The heartbeat. Intended to be called by OS Scheduler (crontab/LaunchAgent).
- **Execution flow**:
  1. Find pending jobs (where `nextRunAt <= now`).
  2. For each job:
     - Check lock.
     - Spawn `nooa run` (reuse existing execution engine).
     - Track telemetry (`cron.job.success/failure`).
     - Update `nextRunAt`.

## Use Cases (NOOA-Grade Jobs)
- **Daily Health**: `nooa ci` + automated report.
- **Nightly Eval**: `nooa eval run review --suite nightly`.
- **Memory Maintenance**: `nooa memory summarize` to keep the context clean.
- **Dep Audit**: Auto-check dependencies and flag security issues.

## NOOA UX Standard
- [ ] `--help` and `--json` for every subcommand.
- [ ] Stdout clean for JSON; logs redirected to SQLite or files.
- [ ] Telemetry correlation with `traceId`.
- [ ] Built-in timeout guards with `--max-runtime`.

## Roadmap
1. [ ] **DB Schema**: Migration for `cron_jobs` and `cron_runs`.
2. [ ] **Tick Logic**: Implement the "Decision Ring" (what runs when).
3. [ ] **CLI Layer**: Subcommands with standardized flags.
4. [ ] **Integration**: Connect with `ReflectionEngine` for "Material Change" detection.
