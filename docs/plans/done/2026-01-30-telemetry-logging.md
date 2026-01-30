# Telemetry + Structured Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add structured logging and persistent telemetry (SQLite/MySql Lite) with trace IDs, and instrument core CLI commands without changing their user-facing stdout.

**Architecture:** Create `src/core/logger.ts` for JSON structured logs to stderr and `src/core/telemetry.ts` for persistent event storage in `nooa.db`. Commands will emit structured logs + telemetry events and forward rich events to `EventBus`.

**Tech Stack:** Bun, bun:sqlite, TypeScript, EventBus.

---

### Task 1: Add telemetry skill (verbose) with TDD creation log

**Files:**
- Create: `.agent/skills/telemetry-observability/SKILL.md`
- Create: `.agent/skills/telemetry-observability/CREATION-LOG.md`

**Step 1: Write failing tests (baseline scenarios)**
- In `CREATION-LOG.md`, document 3 pressure scenarios and the baseline failure (no telemetry, no structured logs).

**Step 2: Write the skill (verbose)**
- Include: overview, when to use, core pattern (before/after), event schema, trace IDs, telemetry DB usage, EventBus payloads, quick reference, common mistakes, red flags, rationalization table, one complete example.

**Step 3: Verify scenario outcomes**
- Update `CREATION-LOG.md` with expected compliant behavior once the skill is applied.

**Step 4: Commit**
```bash
git add .agent/skills/telemetry-observability
git commit -m "docs: add telemetry observability skill"
```

---

### Task 2: Core logger (TDD)

**Files:**
- Create: `src/core/logger.ts`
- Create: `src/core/logger.test.ts`

**Step 1: Write failing test**
```ts
import { describe, expect, it, spyOn } from "bun:test";
import { createLogger } from "./logger";

describe("Logger", () => {
  it("writes structured JSON with context", () => {
    const logger = createLogger();
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.setContext({ trace_id: "t-123", command: "read" });
    logger.info("read.success", { bytes: 10 });
    expect(stderrSpy).toHaveBeenCalled();
    const payload = JSON.parse(String(stderrSpy.mock.calls[0]?.[0] ?? ""));
    expect(payload.level).toBe("info");
    expect(payload.event).toBe("read.success");
    expect(payload.trace_id).toBe("t-123");
    expect(payload.metadata.bytes).toBe(10);
    stderrSpy.mockRestore();
  });
});
```

**Step 2: Run test (verify RED)**
```bash
bun test src/core/logger.test.ts
```
Expected: FAIL (module missing)

**Step 3: Implement minimal logger**
- JSON output to stderr
- `setContext`, `clearContext`, `info`, `warn`, `error`, `debug`
- `createTraceId()` helper

**Step 4: Run test (verify GREEN)**
```bash
bun test src/core/logger.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/core/logger.ts src/core/logger.test.ts
git commit -m "feat: add structured logger"
```

---

### Task 3: Telemetry store (TDD)

**Files:**
- Create: `src/core/telemetry.ts`
- Create: `src/core/telemetry.test.ts`

**Step 1: Write failing test**
```ts
import { describe, expect, it } from "bun:test";
import { TelemetryStore } from "./telemetry";

const TEST_DB = "telemetry-test.db";

describe("TelemetryStore", () => {
  it("tracks events in sqlite", () => {
    const telemetry = new TelemetryStore(TEST_DB);
    telemetry.track({
      event: "read.success",
      level: "info",
      success: true,
      duration_ms: 12,
      trace_id: "t-1",
      metadata: { bytes: 10 }
    });

    const rows = telemetry.list({ event: "read.success" });
    expect(rows.length).toBe(1);
    expect(rows[0].event).toBe("read.success");
    telemetry.close();
  });
});
```

**Step 2: Run test (verify RED)**
```bash
bun test src/core/telemetry.test.ts
```
Expected: FAIL (module missing)

**Step 3: Implement TelemetryStore**
- Use `bun:sqlite` to create `telemetry` table and indexes
- `track`, `list`, `close`
- Default DB path: `nooa.db`

**Step 4: Run test (verify GREEN)**
```bash
bun test src/core/telemetry.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/core/telemetry.ts src/core/telemetry.test.ts
git commit -m "feat: add telemetry store"
```

---

### Task 4: Instrument CLI commands (TDD)

**Files:**
- Modify: `src/features/read/cli.ts`
- Modify: `src/features/code/cli.ts`
- Add tests or update existing tests if needed

**Step 1: Write failing test (one command)**
- Add a test to ensure telemetry is recorded (use temp DB and dependency injection if needed).

**Step 2: Run test (verify RED)**
```bash
bun test src/features/read/cmd.test.ts
```
Expected: FAIL (telemetry not recorded)

**Step 3: Implement minimal instrumentation**
- `logger` emits JSON to stderr
- `telemetry.track` writes to sqlite
- include: `trace_id`, `duration_ms`, `success`, `bytes`
- emit `bus?.emit("telemetry.tracked", ...)`

**Step 4: Run test (verify GREEN)**
```bash
bun test src/features/read/cmd.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/features/read/cli.ts src/features/code/cli.ts
 git commit -m "feat: instrument read/code commands with telemetry"
```

---

### Task 5: Final verification

**Step 1: Run full test suite**
```bash
bun test
```
Expected: PASS

**Step 2: Run checks**
```bash
bun check
bun run linter
```
Expected: PASS

**Step 3: Commit any fixes**
```bash
git add -A
git commit -m "chore: finalize telemetry instrumentation"
```
