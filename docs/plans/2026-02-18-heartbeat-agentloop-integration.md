# Heartbeat AgentLoop Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fazer o heartbeat executar fluxo agentic real (AgentLoop) em vez de apenas registrar texto do `HEARTBEAT.md`.

**Architecture:** `CronDaemon` continua sendo o scheduler único. O método privado `runHeartbeat()` (linha 109 de `daemon.ts`) atualmente só lê o arquivo e retorna o texto bruto. Precisamos substituí-lo por um executor que usa `HeartbeatService.buildPrompt()` + `agent.engine.run()`. O `tick()` (linha 155) já chama `runHeartbeat()` para o `HEARTBEAT_COMMAND` — basta trocar a implementação interna.

**Dependências existentes que DEVEM ser reusadas:**
- `src/runtime/heartbeat/service.ts` — `HeartbeatService.buildPrompt()` já monta o prompt com timestamp
- `src/features/agent/engine.ts` — `run({ prompt, sessionKey })` já usa `AgentLoop` + `AiEngine`
- `src/features/cron/daemon.ts` — `CronDaemon.runHeartbeat()` é o ponto exato de integração
- `HEARTBEAT_COMMAND = "heartbeat:run"` e `HEARTBEAT_JOB_NAME = "__system_heartbeat__"` já definidos

**Tech Stack:** TypeScript, Bun, AgentLoop runtime, CronDaemon, bun:test.

---

### Task 1: Criar executor de heartbeat

**Files:**
- Create: `src/runtime/heartbeat/executor.ts`
- Create: `src/runtime/heartbeat/executor.test.ts`

**Step 1: Write failing tests**

```typescript
// src/runtime/heartbeat/executor.test.ts
import { describe, expect, it, mock } from "bun:test";
import { executeHeartbeatTask } from "./executor";

describe("executeHeartbeatTask", () => {
  it("calls agent.run with heartbeat prompt and session key 'heartbeat:system'", async () => {
    const mockAgentRun = mock(async ({ prompt, sessionKey }: { prompt: string; sessionKey: string }) => ({
      ok: true as const,
      data: { sessionKey, content: "All good. HEARTBEAT_OK." },
    }));

    const result = await executeHeartbeatTask("/tmp/test-ws", {
      agentRun: mockAgentRun,
    });

    expect(mockAgentRun).toHaveBeenCalledTimes(1);
    const callArgs = mockAgentRun.mock.calls[0][0];
    expect(callArgs.sessionKey).toBe("heartbeat:system");
    expect(callArgs.prompt).toContain("Current time:");
    expect(result.status).toBe("success");
    expect(result.output).toContain("HEARTBEAT_OK");
  });

  it("returns failure when agent.run fails", async () => {
    const mockAgentRun = mock(async () => ({
      ok: false as const,
      error: { code: "agent.runtime_error", message: "LLM unavailable" },
    }));

    const result = await executeHeartbeatTask("/tmp/test-ws", {
      agentRun: mockAgentRun,
    });

    expect(result.status).toBe("failure");
    expect(result.error).toContain("LLM unavailable");
  });

  it("returns HEARTBEAT_OK when HEARTBEAT.md is empty", async () => {
    const mockAgentRun = mock(async () => ({
      ok: true as const,
      data: { sessionKey: "heartbeat:system", content: "HEARTBEAT_OK" },
    }));

    const result = await executeHeartbeatTask("/tmp/test-ws", {
      agentRun: mockAgentRun,
    });

    expect(result.status).toBe("success");
    expect(result.output).toBe("HEARTBEAT_OK");
  });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/runtime/heartbeat/executor.test.ts`
Expected: FAIL — `Cannot find module "./executor"`

**Step 3: Implementar executor**

```typescript
// src/runtime/heartbeat/executor.ts
import type { SdkResult } from "../../core/types";
import { HeartbeatService } from "./service";

export interface HeartbeatExecutionResult {
  status: "success" | "failure";
  output?: string;
  error?: string;
}

type AgentRunFn = (input: {
  prompt: string;
  sessionKey: string;
}) => Promise<SdkResult<{ sessionKey: string; content: string }>>;

export interface HeartbeatExecutorDeps {
  agentRun?: AgentRunFn;
}

export async function executeHeartbeatTask(
  workspace: string,
  deps: HeartbeatExecutorDeps = {},
): Promise<HeartbeatExecutionResult> {
  const service = new HeartbeatService(workspace);
  const prompt = await service.buildPrompt();

  // Lazy import to avoid circular dependency at module load time
  const agentRun =
    deps.agentRun ??
    (await import("../../features/agent/engine").then((m) => m.run));

  const result = await agentRun({ prompt, sessionKey: "heartbeat:system" });

  if (!result.ok) {
    return { status: "failure", error: result.error.message };
  }

  return { status: "success", output: result.data.content };
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/runtime/heartbeat/executor.test.ts`
Expected: PASS (3 tests)

**Step 5: Lint**
Run: `bun run check`
Expected: Sem erros.

**Step 6: Commit**
`git add src/runtime/heartbeat/executor.ts src/runtime/heartbeat/executor.test.ts`
`git commit -m "feat(heartbeat): add agentic heartbeat executor using AgentLoop"`

---

### Task 2: Integrar executor no CronDaemon

**Files:**
- Modify: `src/features/cron/daemon.ts`
- Modify: `src/features/cron/daemon.test.ts`

**Ponto exato de integração:**  
`CronDaemon.runHeartbeat()` (linha 109) atualmente lê o arquivo e retorna texto bruto.  
`tick()` (linha 171) chama `runHeartbeat()` diretamente para `HEARTBEAT_COMMAND`.  
Devemos substituir `runHeartbeat()` por uma chamada ao `executeHeartbeatTask`.

**Step 1: Write failing tests**

```typescript
// Adicionar em src/features/cron/daemon.test.ts
import { executeHeartbeatTask } from "../../runtime/heartbeat/executor";

describe("CronDaemon heartbeat integration", () => {
  it("calls executeHeartbeatTask for __system_heartbeat__ job (not raw file read)", async () => {
    const mockExecutor = mock(async () => ({
      status: "success" as const,
      output: "Checked inbox. HEARTBEAT_OK.",
    }));

    const daemon = new CronDaemon(service, {
      workspace: tmpDir,
      heartbeatEnabled: true,
      heartbeatExecutor: mockExecutor, // nova opção injetável
    });

    // Forçar job heartbeat como due
    await daemon.ensureSystemJobs();
    service.updateRuntime("__system_heartbeat__", {
      next_run_at: new Date(Date.now() - 1000).toISOString(),
    });

    await daemon.tick(new Date());

    expect(mockExecutor).toHaveBeenCalledTimes(1);
    const logs = service.getLogs("__system_heartbeat__", 1);
    expect(logs[0].output).toContain("HEARTBEAT_OK");
  });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/cron/daemon.test.ts`
Expected: FAIL — `heartbeatExecutor` não existe na interface.

**Step 3: Minimal implementation**

Em `CronDaemonOptions` adicionar:
```typescript
heartbeatExecutor?: (workspace: string) => Promise<{ status: "success" | "failure"; output?: string; error?: string }>;
```

Em `CronDaemon.constructor` armazenar `this.heartbeatExecutor`.

Substituir `runHeartbeat()` (linha 109):
```typescript
private async runHeartbeat(): Promise<string> {
  const result = await this.heartbeatExecutor(this.workspace);
  return result.output ?? (result.status === "failure" ? `ERROR: ${result.error}` : "HEARTBEAT_OK");
}
```

No construtor, default:
```typescript
this.heartbeatExecutor = options.heartbeatExecutor ??
  ((ws: string) => import("../../runtime/heartbeat/executor")
    .then(m => m.executeHeartbeatTask(ws)));
```

**Step 4: Verify GREEN**
Run: `bun test ./src/features/cron/daemon.test.ts`
Expected: PASS

**Step 5: Lint e full test suite**
Run: `bun run check && bun test`
Expected: Sem erros, todos os testes passam.

**Step 6: Commit**
`git add src/features/cron/daemon.ts src/features/cron/daemon.test.ts`
`git commit -m "feat(cron): run heartbeat job through AgentLoop executor"`

---

### Task 3: Dogfooding end-to-end

**Step 1:** `bun index.ts cron --daemon start --json`
**Step 2:** Verificar que `.nooa/HEARTBEAT.md` existe (senão: `bun index.ts init`)
**Step 3:** Aguardar um ciclo ou reduzir `NOOA_HEARTBEAT_SCHEDULE=10s` para teste
**Step 4:** `bun index.ts cron logs __system_heartbeat__ --limit 3 --json`
**Step 5:** Verificar que o log contém resposta do agente (não texto bruto do arquivo)
**Step 6:** `bun index.ts cron --daemon stop --json`

---

### Notas de integração

- **`AiEngineAgentProvider` retorna `toolCalls: []` sempre** (linha 21 de `provider.ts`). O heartbeat funciona mesmo assim — o agente responde em texto. Tool-calling nativo é um upgrade separado.
- **Sessão `heartbeat:system`** é persistida em `.nooa/sessions/heartbeat_system.json`. Isso é intencional — o heartbeat tem memória de contexto entre execuções.
- **Anti-loop:** o heartbeat usa `sessionKey: "heartbeat:system"` fixo, não pode chamar `spawn` (guard já existe no `AgentLoop`).
