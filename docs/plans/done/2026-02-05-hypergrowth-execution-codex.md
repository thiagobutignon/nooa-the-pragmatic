# Hypergrowth Execution Plan (Codex)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consertar a fundação (EventBus + Event Schema + WorktreePool) e implementar o WorkflowEngine com gates mínimos, garantindo observabilidade e gates reais antes do TUI.

**Architecture:** Primeiro consertar plumbing (EventBus + eventos), depois criar o “enforcer” (WorkflowEngine + Gates), e só então preparar o TUI read-only como observer.

**Tech Stack:** Bun, TypeScript, Ink.js, SQLite telemetry, Git worktrees.

---

### Task 1: EventBus Resurrection (sem skips)

**Files:**
- Modify: `src/core/event-bus.test.ts`
- Modify: `src/core/event-bus.ts`

**Step 1: Write failing test (unskip)**

Unskip todos os testes em `src/core/event-bus.test.ts`.

**Step 2: Run test to verify it fails**

Run: `bun test src/core/event-bus.test.ts`  
Expected: FAIL (se houver bug real no EventBus)

**Step 3: Minimal fix**

Corrigir `src/core/event-bus.ts` para passar nos testes.

**Step 4: Run test to verify it passes**

Run: `bun test src/core/event-bus.test.ts`  
Expected: PASS (0 fail)

**Step 5: Commit**

```bash
git add src/core/event-bus.ts src/core/event-bus.test.ts
git commit -m "fix: resurrect event bus"
```

---

### Task 2: Event Schema Canônico

**Files:**
- Create: `src/core/events/schema.ts`
- Modify: `src/core/event-bus.ts`
- Test: `src/core/events/schema.test.ts`

**Step 1: Write failing test**

```ts
import { describe, it, expect } from "bun:test";
import { NOOAEvent } from "./schema";

describe("Event schema", () => {
  it("is a closed union", () => {
    const evt: NOOAEvent = { type: "workflow.started", traceId: "t", goal: "x" };
    expect(evt.type).toBe("workflow.started");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/events/schema.test.ts`  
Expected: FAIL (module not found)

**Step 3: Minimal implementation**

Implementar `NOOAEvent` union exaustiva em `schema.ts`.  
Tipar `eventBus.emit()` para aceitar `NOOAEvent`.

**Step 4: Run test to verify it passes**

Run: `bun test src/core/events/schema.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/events/schema.ts src/core/events/schema.test.ts src/core/event-bus.ts
git commit -m "feat: define canonical event schema"
```

---

### Task 3: WorktreePool MVP

**Files:**
- Create: `src/core/worktree/Pool.ts`
- Test: `src/core/worktree/Pool.test.ts`

**Step 1: Write failing test**

```ts
import { describe, it, expect } from "bun:test";
import { WorktreePool } from "./Pool";

describe("WorktreePool", () => {
  it("acquires and releases worktrees", async () => {
    const pool = new WorktreePool({ maxWorktrees: 1 });
    const wt = await pool.acquire("feat/pool-test");
    expect(wt.path).toContain(".worktrees");
    await pool.release(wt);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/worktree/Pool.test.ts`  
Expected: FAIL (module not found)

**Step 3: Minimal implementation**

Implementar `WorktreePool` com:
- `acquire(branch)`
- `release(handle)`
- `list()`
- config com `maxWorktrees`

**Step 4: Run test to verify it passes**

Run: `bun test src/core/worktree/Pool.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/worktree/Pool.ts src/core/worktree/Pool.test.ts
git commit -m "feat: add worktree pool mvp"
```

---

### Task 4: Workflow Engine + Gates

**Files:**
- Create: `src/core/workflow/types.ts`
- Create: `src/core/workflow/Engine.ts`
- Create: `src/core/workflow/gates/SpecGate.ts`
- Create: `src/core/workflow/gates/TestGate.ts`
- Create: `src/core/workflow/gates/DogfoodGate.ts`
- Test: `src/core/workflow/Engine.test.ts`

**Step 1: Write failing test**

```ts
import { describe, it, expect } from "bun:test";
import { WorkflowEngine } from "./Engine";
import { SpecGate } from "./gates/SpecGate";

describe("WorkflowEngine", () => {
  it("fails when spec is missing", async () => {
    const engine = new WorkflowEngine();
    const result = await engine.run([
      { id: "spec", gate: new SpecGate(), action: async () => null },
    ], { traceId: "t", command: "read", args: {}, cwd: process.cwd() });
    expect(result.ok).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/workflow/Engine.test.ts`  
Expected: FAIL (module not found)

**Step 3: Minimal implementation**

Implementar `WorkflowContext`, `Gate`, `WorkflowStep`, e `WorkflowEngine.run()`.

**Step 4: Run test to verify it passes**

Run: `bun test src/core/workflow/Engine.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/workflow
git commit -m "feat: workflow engine with gates"
```

---

### Task 5: Event Integration (3 comandos)

**Files:**
- Modify: `src/features/act/cli.ts`
- Modify: `src/features/fix/cli.ts`
- Modify: `src/features/worktree/cli.ts`

**Step 1: Write failing tests**

Criar/ajustar testes para validar eventos emitidos em cada comando.

**Step 2: Run tests to verify they fail**

Run: `bun test src/features/act/cli.test.ts` (e equivalentes)  
Expected: FAIL (eventos ausentes)

**Step 3: Minimal implementation**

Emitir eventos estruturados **após stdout/stderr**.

**Step 4: Run tests to verify they pass**

Run: `bun test src/features/act/cli.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/act/cli.ts src/features/fix/cli.ts src/features/worktree/cli.ts
git commit -m "feat: emit structured events in core commands"
```

---

### Task 6: TUI Read-Only Tail (MVP)

**Files:**
- Create: `src/tui/tail.tsx`
- Add script: `package.json` (`tui:tail`)

**Step 1: Write failing test**

Create minimal render test for Ink component.

**Step 2: Run test to verify it fails**

Run: `bun test src/tui/tail.test.tsx`  
Expected: FAIL (module not found)

**Step 3: Minimal implementation**

Render último N eventos (traceId + step).

**Step 4: Run test to verify it passes**

Run: `bun test src/tui/tail.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/tui/tail.tsx src/tui/tail.test.tsx package.json
git commit -m "feat: tui read-only tail"
```

---

**Plan complete.**
