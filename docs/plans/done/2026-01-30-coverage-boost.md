# Coverage Boost Implementation Plan

> **STATUS:** Plano revisado - FOCO EM GAPS CRÍTICOS (0-3% cobertura)

**Goal:** Increase test coverage to 90%+ across all core features (Read, Code, Bridge, Jobs) and core modules (Logger, Telemetry, EventBus).

**Architecture:** We will use **Agent-CLI-First** principles to test the `execute` entry points of each feature. We will mock only what is strictly necessary (e.g., `process.stdin` if required) but prefer real file system interactions in a temporary test directory.

**Tech Stack:** Bun, Bun Test, TypeScript, execa (for integration tests).

---

## PROBLEMAS CRÍTICOS IDENTIFICADOS

**BLOQUEADORES (0-5% cobertura):**
- ❌ `src/features/code/cli.ts`: **3.16%** - 297 linhas não testadas
- ❌ `src/features/jobs/cli.ts`: **0%** - 120 linhas não testadas  
- ❌ `src/features/bridge/cli.ts`: **0% linhas** - 120 linhas não testadas

**GAPS IMPORTANTES (40-90%):**
- ⚠️ `src/features/read/cli.ts`: **44.74%** - 56 linhas não cobertas
- ⚠️ `src/core/logger.ts`: **86.79%** - faltam debug/warn/error
- ⚠️ `src/core/event-bus.ts`: **75%** - faltam off/clear
- ⚠️ `src/features/resume/cli.ts`: **80.93%** - gaps em error handling

**Ordem de Prioridade Revisada:**
1. Task 1 (Code CLI) - MAIOR GAP
2. Task 2 (Bridge + Jobs) - ZERO coverage
3. Task 3 (Read CLI) - 44% precisa chegar a 90%
4. Task 4 (Core modules) - menor gap mas importante

---

### Task 1: Code Feature Coverage (TDD) - CRITICAL (3.16%)

**Files:**
- Modify: `src/features/code/cli.ts`
- Create: `src/features/code/execute.test.ts`

**Step 1: Write comprehensive UNIT tests for `execute()`**
- ✅ Successful write (subagent-driven)
- ❌ Failure (missing path) -> exit 2
- ❌ Failure (missing content) -> exit 2  
- ❌ JSON output mode
- ❌ Dry-run mode
- ❌ Overwrite logic (with/without --overwrite)
- ❌ Read from stdin (mocked)
- ❌ Read from file (--from)
- ❌ Patch success/failure branches

**Step 2: Run tests to verify RED**
Run: `bun test src/features/code/execute.test.ts`

**Step 3: Implement/Refactor minimal CLI logic**
Ensure all `telemetry.track` calls are reached. Refactor `cli.ts` if needed to make it unit-testable.

**Step 4: Verify GREEN**
Run: `bun test src/features/code/execute.test.ts --coverage`
Goal: 90%+ for `code/cli.ts`.

**Step 5: Commit**
```bash
git add src/features/code/
git commit -m "test: boost code feature coverage to 90%+"
```

---

### Task 2: Bridge & Jobs CLI Coverage (TDD) - CRITICAL (0%)

**Files:**
- Create: `src/features/bridge/execute.test.ts`
- Create: `src/features/jobs/execute.test.ts`
- Modify: `src/features/bridge/cli.ts`
- Modify: `src/features/jobs/cli.ts`

**Step 1: Add UNIT tests that call execute() directly**
- Bridge: `--list`, `--spec`, errors, telemetry.
- Jobs: `add`, `list`, `match`, `apply`, errors, telemetry.

**Step 2: Run tests to verify RED**
Run: `bun test src/features/bridge/execute.test.ts src/features/jobs/execute.test.ts`

**Step 3: Implement minimal wiring**
Ensure `execute()` is properly exported and functional.

**Step 4: Verify Progress**
Run: `bun test --coverage`

**Step 5: Commit**
```bash
git add src/features/bridge/ src/features/jobs/
git commit -m "test: bridge and jobs CLI coverage"
```

---

### Task 3: Read Feature Coverage (TDD) - (44.74%)

**Files:**
- Modify: `src/features/read/cli.ts`
- Modify: `src/features/read/cmd.test.ts`

**Step 1: Add tests for missing branches**
- Missing path positional (exit 2).
- Stats flag branches.
- Excerpt flag branches.
- Error logging branches (110-133).

**Step 2: Run tests to verify failure**
Run: `bun test src/features/read/cmd.test.ts`

**Step 4: Verify results**
Run: `bun test src/features/read/cmd.test.ts --coverage`
Goal: 90%+ for `read/cli.ts`.

**Step 5: Commit**
```bash
git add src/features/read/
git commit -m "test: expand read feature coverage"
```

---

### Task 4: Core Module Alignment (TDD) - (75-86%)

**Files:**
- Modify: `src/core/logger.ts`, `src/core/event-bus.ts`
- Modify: `src/core/logger.test.ts`, `src/core/event-bus.test.ts`

**Step 1: Write failing tests for uncovered lines**
- `Logger`: `clearContext()`, `clearContext('key')`, `debug()`, `warn()`, `error()`.
- `EventBus`: `off(event, handler)`, `clear()`.

**Step 2: Run tests to verify RED**
Run: `bun test src/core/logger.test.ts src/core/event-bus.test.ts`

**Step 4: Verify GREEN**
Run: `bun test src/core/logger.test.ts src/core/event-bus.test.ts`

**Step 5: Commit**
```bash
git add src/core/*.ts src/core/*.test.ts
git commit -m "test: reach 100% coverage on core logger and event-bus"
```

---

### Task 5: Index.ts Cleanup & Final Verification

**Files:**
- Modify: `index.ts`
- Modify: `index.nooa.test.ts`

**Step 1: Remove legacy code / Test remaining branches**
- Remove `Legacy / Unmigrated` block.
- Test `main()` for: Command not found, Registry failure, Loader failure.

**Step 2: Run full verification**
Run: `bun test --coverage`
Expected: **85% - 90%+ total coverage.**

**Step 3: Commit**
```bash
git add index.ts index.nooa.test.ts
git commit -m "chore: cleanup legacy dispatch and finalize coverage"
```
