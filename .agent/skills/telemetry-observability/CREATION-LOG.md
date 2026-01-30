# Telemetry Observability Skill - Creation Log (TDD)

Date: 2026-01-30
Owner: NOOA The Pragmatic (Codex)
Context: Subagents are not available in Codex; baseline tests are simulated via manual pressure scenarios. The goal is to capture expected failure modes before the skill exists and define the compliance outcomes after the skill is applied.

---

## RED Phase (Baseline Failures Without Skill)

### Scenario 1: Production bug under time pressure
**Pressure:** Time (MTTR target), stakeholder urgency, token budget.
**Prompt:**
"Users report `nooa read` sometimes returns empty output. Fix it now."

**Baseline behavior (failure):**
- Agent adds `console.log` at random locations.
- No structured logs, no timestamps, no trace IDs.
- Output mixes with user stdout (corrupts CLI output).
- No persisted telemetry, so there is no historical evidence of when the issue started.

**Rationalizations observed (baseline):**
- "I'll just add a couple of console.log lines; it's faster."
- "Telemetry later—first fix the bug."
- "We can reproduce once and be done."

**Why this fails:**
- No deterministic evidence trail.
- Debugging costs explode and MTTR increases.

---

### Scenario 2: Performance regression after refactor
**Pressure:** Regression, lack of profiling data, uncertain root cause.
**Prompt:**
"`nooa code write` is now 10x slower on large inputs."

**Baseline behavior (failure):**
- No duration metrics recorded in DB.
- No trace context to correlate slow runs with inputs or code paths.
- Can’t compare before/after without rewriting custom timers.

**Rationalizations observed (baseline):**
- "It’s probably the patch mode. Let's guess and ship."
- "We don’t need full telemetry—just trust it."

**Why this fails:**
- No objective measurement. Debugging becomes guesswork.

---

### Scenario 3: OKR reporting and cost optimization
**Pressure:** Need MTTR, cost per feature, success rates.
**Prompt:**
"Show if MTTR is below 30 minutes this month."

**Baseline behavior (failure):**
- No historical telemetry stored.
- No success/failure tracking per command.
- No aggregations possible.

**Rationalizations observed (baseline):**
- "We can estimate from memory."
- "Let's add metrics later when we have time."

**Why this fails:**
- OKR cannot be proven or optimized.

---

## GREEN Phase (Expected Behavior With Skill Applied)

### Scenario 1: Production bug under time pressure
- Agent uses structured logs with trace IDs and timestamps.
- Errors are captured in telemetry with context (command, duration, success=false).
- User stdout remains clean; logs go to stderr.
- MTTR is measurable and root cause is visible quickly.

### Scenario 2: Performance regression after refactor
- Telemetry tracks duration, size, and mode (`write` vs `patch`).
- Queryable history reveals p95/p99 regressions.
- Agent can pinpoint commit window and optimize with evidence.

### Scenario 3: OKR reporting and cost optimization
- Telemetry stored in SQLite with indexed queries.
- Metrics (success rate, average duration) are computed from real data.
- OKR dashboards and reports are reproducible.

---

## REFACTOR Phase (Loopholes to Close)

- Prevent mixed stdout/stderr logs.
- Require trace IDs for any operation that writes or mutates state.
- Require telemetry for success/failure and duration on core commands.

---

## Next Actions

- Create `SKILL.md` with verbose guidance and guardrails.
- Implement logger + telemetry store.
- Instrument core commands with trace IDs, structured logs, and telemetry.
