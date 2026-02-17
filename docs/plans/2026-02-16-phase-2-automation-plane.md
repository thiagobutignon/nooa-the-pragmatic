# Phase 2: Automation Plane (Heartbeat + Subagents + Cron Daemon)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar NOOA de reativo para proativo: heartbeat automático via HEARTBEAT.md, subagentes (spawn async + subagent sync), e cron daemon real.

**Architecture:** Heartbeat lê `.nooa/HEARTBEAT.md` periodicamente e executa tarefas via cron. Subagentes são instâncias isoladas do AgentLoop com ToolRegistry restrito. O daemon roda sobre `CronStore` (SQLite) como fonte única de verdade, sem scheduler paralelo em arquivo.

**Tech Stack:** TypeScript, Bun, AgentLoop (Phase 1), ToolRegistry (Phase 0), bun:test

**Worktree:** `git worktree add ../nooa-phase-2 -b codex/phase-2-automation`

**Dependência:** Phase 1 concluída e mergeada em main.

---

### Task 1: Heartbeat Service

**Files:**
- Create: `src/runtime/heartbeat/service.ts`
- Test: `src/runtime/heartbeat/service.test.ts`
- Create: `.nooa/HEARTBEAT.md` (template)

**Step 1: Criar worktree**

```bash
git worktree add ../nooa-phase-2 -b codex/phase-2-automation
cd ../nooa-phase-2
```

**Step 2: Escrever teste que falha**

```typescript
// src/runtime/heartbeat/service.test.ts
import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { HeartbeatService } from "./service";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("HeartbeatService", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "nooa-hb-"));
    await mkdir(join(workspace, ".nooa"), { recursive: true });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("reads HEARTBEAT.md content", async () => {
    await writeFile(
      join(workspace, ".nooa", "HEARTBEAT.md"),
      "# Periodic Tasks\n- Check disk usage every 30 minutes\n- Summarize daily notes at end of day",
    );

    const service = new HeartbeatService(workspace);
    const content = await service.readHeartbeat();
    expect(content).toContain("Check disk usage");
  });

  it("returns empty string if no HEARTBEAT.md", async () => {
    const service = new HeartbeatService(workspace);
    const content = await service.readHeartbeat();
    expect(content).toBe("");
  });

  it("creates default template if requested", async () => {
    const service = new HeartbeatService(workspace);
    await service.ensureTemplate();
    const content = await service.readHeartbeat();
    expect(content).toContain("Periodic Tasks");
  });

  it("builds heartbeat prompt with timestamp", async () => {
    await writeFile(
      join(workspace, ".nooa", "HEARTBEAT.md"),
      "- Check for new issues",
    );

    const service = new HeartbeatService(workspace);
    const prompt = await service.buildPrompt();
    expect(prompt).toContain("Check for new issues");
    expect(prompt).toContain("Current time:");
  });
});
```

**Step 3: Rodar para falha, implementar, verificar**

Run: `bun test src/runtime/heartbeat/service.test.ts`

**Step 4: Implementar HeartbeatService**

Lê `.nooa/HEARTBEAT.md`, monta prompt com timestamp, executa via handler (AgentLoop ou executor), retorna resultado.

**Step 5: Commit**

```bash
git add src/runtime/heartbeat/
git commit -m "feat(runtime): add HeartbeatService with HEARTBEAT.md template and prompt builder"
```

---

### Task 2: Spawn Tool (async subagent)

**Files:**
- Create: `src/runtime/tools/spawn.ts`
- Test: `src/runtime/tools/spawn.test.ts`

**Step 1: Escrever teste que falha**

```typescript
// src/runtime/tools/spawn.test.ts
import { describe, expect, it, mock } from "bun:test";
import { createSpawnTool } from "./spawn";
import { ToolRegistry } from "../tool-registry";
import { toolResult } from "../types";

describe("SpawnTool", () => {
  it("spawns a subagent and returns async result", async () => {
    const mockExecutor = mock(async (task: string) => toolResult(`Done: ${task}`));
    const tool = createSpawnTool(mockExecutor);

    const result = await tool.execute({ task: "fetch news", label: "news" });
    expect(result.async).toBe(true);
    expect(result.forLlm).toContain("news");
  });

  it("requires task parameter", async () => {
    const mockExecutor = mock(async () => toolResult("ok"));
    const tool = createSpawnTool(mockExecutor);

    const result = await tool.execute({});
    expect(result.isError).toBe(true);
  });
});
```

**Step 2: Implementar, verificar**

Run: `bun test src/runtime/tools/spawn.test.ts`

**Step 3: Commit**

```bash
git add src/runtime/tools/spawn.ts src/runtime/tools/spawn.test.ts
git commit -m "feat(runtime): add spawn tool for async subagent execution"
```

---

### Task 3: Subagent Tool (sync delegation)

**Files:**
- Create: `src/runtime/tools/subagent.ts`
- Test: `src/runtime/tools/subagent.test.ts`

**Step 1: Escrever teste que falha**

```typescript
// src/runtime/tools/subagent.test.ts
import { describe, expect, it, mock } from "bun:test";
import { createSubagentTool } from "./subagent";
import { toolResult } from "../types";

describe("SubagentTool", () => {
  it("executes subagent synchronously and returns result", async () => {
    const mockExecutor = mock(async (task: string) =>
      toolResult(`Completed: ${task}`),
    );
    const tool = createSubagentTool(mockExecutor);

    const result = await tool.execute({ task: "analyze code style" });
    expect(result.async).toBe(false);
    expect(result.forLlm).toContain("Completed");
  });

  it("truncates forUser at 500 chars", async () => {
    const longResult = "A".repeat(1000);
    const mockExecutor = mock(async () => toolResult(longResult));
    const tool = createSubagentTool(mockExecutor);

    const result = await tool.execute({ task: "long task" });
    expect(result.forUser!.length).toBeLessThanOrEqual(503); // 500 + "..."
  });
});
```

**Step 2: Implementar, verificar, commit**

```bash
git add src/runtime/tools/subagent.ts src/runtime/tools/subagent.test.ts
git commit -m "feat(runtime): add subagent tool for sync task delegation"
```

---

### Task 4: Cron Daemon (scheduler real)

**Files:**
- Modify: `src/features/cron/service.ts`
- Create: `src/features/cron/daemon.ts`
- Modify: `src/features/cron/cli.ts`
- Test: `src/features/cron/daemon.test.ts`
- Test: `src/features/cron/cli.test.ts`

**Step 1: Escrever teste que falha**

Testar `CronDaemon` com `CronService` real (SQLite temporário): execução de jobs `due`, atualização de `next_run_at`, e ciclo `start|stop|status` via CLI.

**Step 2: Implementar CronDaemon**

Sem scheduler paralelo. O daemon deve:
- Ler jobs do `CronStore` (SQLite)
- Calcular `next_run_at`
- Executar jobs vencidos periodicamente
- Persistir logs/estado no próprio `CronStore`
- Expor `--daemon start|stop|status` (e `cron daemon <cmd>`) na CLI

**Step 3: Commit**

```bash
git add src/features/cron/
git commit -m "feat(cron): add real daemon based on CronStore and wire CLI daemon lifecycle"
```

---

### Task 5: Integrar Heartbeat no cron daemon

**Files:**
- Modify: `src/features/cron/daemon.ts`
- Test: `src/features/cron/daemon.test.ts`

Heartbeat como job nativo do cron (`__system_heartbeat__`) que roda periodicamente (default `30m`), sem store paralelo.

**Step 1: Teste, implementar, commit**

```bash
git commit -m "feat(cron): integrate native heartbeat job into cron daemon loop"
```

---

### Task 6: Registrar spawn e subagent tools no AgentLoop

**Files:**
- Modify: `src/runtime/agent/loop.ts`
- Modify: `src/features/agent/engine.ts`

Registrar `spawn` e `subagent` como tools disponíveis no ToolRegistry do AgentLoop. Spawn não pode chamar spawn (anti-recursion).

**Step 1: Teste, implementar, commit**

```bash
git commit -m "feat(runtime): register spawn and subagent tools in AgentLoop"
```

---

### Task 7: Verificação final de Phase 2

**Step 1:** `bun test` — todos passam
**Step 2:** `bun run check` — sem erros
**Step 3:** `bun run linter` — sem erros (dogfooding)
**Step 4:** `bun test --coverage src/runtime/` — >80%
**Step 5:** `bun index.ts cron --help` — funciona
**Step 6:** Features existentes intactas: `bun test src/features/ src/core/`
