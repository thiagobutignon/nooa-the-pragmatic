---
name: telemetry-observability
description: Use when a CLI/agent lacks structured logging, trace IDs, or persistent telemetry needed for debugging, MTTR tracking, OKR reporting, cost analytics, or reproducible audits.
---

# Telemetry & Observability (Structured Logging + Persistent Metrics)

## Overview
Observability is not optional for a programming agent. If you cannot trace operations, measure duration, and persist outcomes, you cannot debug quickly, hit MTTR goals, or optimize cost. This skill defines the minimal, **structured, queryable** telemetry standard for NOOA.

**Core principle:** Logs must be structured and **telemetry must be persisted**. Console noise is not observability.

## When to Use
Use this skill when:
- debugging is guesswork (no trace IDs or structured logs)
- you cannot answer “what happened last week?” with data
- MTTR, success rate, or cost per feature is not measurable
- stdout is mixed with diagnostics
- there is no queryable telemetry store

Do **not** use this skill for purely visual UI work with no meaningful command execution.

## The Standard (Non-Negotiable)

**1) Structured logs (JSON) to stderr**
- stdout is **data only**
- logs go to stderr in JSON for machine parsing

**2) Persistent telemetry**
- every command emits a telemetry row: event, duration, success, trace_id, metadata
- telemetry is stored in SQLite/MySql Lite

**3) Trace IDs everywhere**
- every command execution creates a trace_id
- trace_id travels across logs, telemetry, and EventBus

**4) EventBus payloads are rich**
- events must include trace_id, timestamp, success, duration_ms, and key parameters

## Core Pattern (Before → After)

### Before (bad)
```ts
console.log("Entry written.");
```

### After (good)
```ts
const traceId = createTraceId();
logger.setContext({ trace_id: traceId, command: "memory", action: "write" });

const start = Date.now();
try {
  await sys.writeMemory(text, type);
  const duration = Date.now() - start;

  telemetry.track({
    event: "memory.write",
    level: "info",
    success: true,
    duration_ms: duration,
    trace_id: traceId,
    metadata: { type, bytes: text.length }
  }, bus);

  logger.info("memory.write.success", {
    type,
    duration_ms: duration,
    bytes: text.length
  });

  bus?.emit("memory.written", { type, duration_ms: duration, trace_id: traceId });
} catch (err) {
  const duration = Date.now() - start;
  telemetry.track({
    event: "memory.write",
    level: "error",
    success: false,
    duration_ms: duration,
    trace_id: traceId,
    metadata: { type, error: (err as Error).message }
  }, bus);

  logger.error("memory.write.failure", err as Error, { type, duration_ms: duration });
  throw err;
}
```

## Event Schema

**Telemetry row**
- `timestamp` (ms)
- `event` (string)
- `level` (info|warn|error)
- `duration_ms` (number)
- `trace_id` (string)
- `success` (boolean)
- `metadata` (JSON string)

**Log entry**
- `timestamp` (ms)
- `level` (debug|info|warn|error)
- `event` (string)
- `trace_id` (string)
- `metadata` (object)

## SQLite Schema (Default)

```sql
CREATE TABLE telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  event TEXT NOT NULL,
  level TEXT NOT NULL,
  duration_ms INTEGER,
  metadata JSON,
  trace_id TEXT,
  success BOOLEAN
);

CREATE INDEX idx_event ON telemetry(event);
CREATE INDEX idx_timestamp ON telemetry(timestamp);
CREATE INDEX idx_trace ON telemetry(trace_id);
```

## Quick Reference (Cheat Sheet)

| Need | Do | Notes |
|---|---|---|
| Generate trace | `createTraceId()` | Must be per command |
| Structured log | `logger.info("event", meta)` | stderr JSON only |
| Persist telemetry | `telemetry.track({...}, bus)` | SQLite insert |
| EventBus | `bus.emit("telemetry.tracked", payload)` | include trace_id |
| Avoid stdout pollution | Only print user output to stdout | logs to stderr |

## Implementation Steps (Minimal)

1) **Create logger**
- JSON to stderr, `setContext`, `info/warn/error/debug`

2) **Create telemetry store**
- SQLite table + indexes
- `track`, `list`, `close`

3) **Instrument commands**
- For read/write/mutations: log start/end + telemetry
- include duration_ms, bytes, success, trace_id

4) **Enforce clean stdout**
- stdout is for user-facing results only
- logs and telemetry never go to stdout

## Common Mistakes

- **Mixing logs with stdout** → breaks piping and tests
- **No trace_id** → cannot correlate events
- **Ad-hoc console.log** → not queryable
- **Telemetry only on success** → hides failure rates
- **No duration_ms** → no performance visibility

## Red Flags (Stop and Fix)

- “I’ll just add a console.log for now.”
- “We can add telemetry later.”
- “No one reads logs anyway.”
- “It’s too small to instrument.”

All of these mean **observability debt**. Fix now, not later.

## Rationalization Table

| Excuse | Reality |
|---|---|
| “Telemetry later” | Later never comes. Instrument now. |
| “Logs are enough” | Logs without structure are noise. |
| “Too small to measure” | Small bugs can be expensive. |
| “I’ll remember what happened” | Memory is not data. |

## One Complete Example (CLI command)

```ts
import { createTraceId, logger } from "../core/logger";
import { telemetry } from "../core/telemetry";

const traceId = createTraceId();
logger.setContext({ trace_id: traceId, command: "read" });
const start = Date.now();

try {
  const content = await readFile(path, "utf-8");
  const duration = Date.now() - start;

  telemetry.track({
    event: "read.success",
    level: "info",
    success: true,
    duration_ms: duration,
    trace_id: traceId,
    metadata: { path, bytes: content.length }
  }, bus);

  logger.info("read.success", { path, bytes: content.length, duration_ms: duration });
} catch (err) {
  const duration = Date.now() - start;
  telemetry.track({
    event: "read.failure",
    level: "error",
    success: false,
    duration_ms: duration,
    trace_id: traceId,
    metadata: { path, error: (err as Error).message }
  }, bus);

  logger.error("read.failure", err as Error, { path, duration_ms: duration });
  throw err;
}
```

## Outcome
With this skill applied, NOOA gains:
- MTTR visibility
- performance regressions detection
- audit trail for operations
- OKR measurement and cost analytics

This is mandatory for hypergrowth-grade reliability.
