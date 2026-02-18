# Gateway Continuous Daemon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Habilitar `nooa gateway` em modo contínuo (daemon real) com `start|stop|status` e supervisão básica de processo.

**Architecture:** Reusar o padrão já adotado em `cron` (`pid file` + subprocess detached) para o gateway. O comando `gateway` passa a suportar lifecycle management sem bloquear o terminal no processo chamador. O runtime do gateway mantém `EventBus` + `Gateway` + `CliChannel` e loop contínuo no processo filho.

**Dependências existentes que DEVEM ser reusadas:**
- `src/features/cron/daemon.ts` — `CronDaemon.startDetached()`, `status()`, `stop()` — copiar o padrão exato de pid file + `Bun.spawn(..., { detached: true })`
- `src/features/gateway/engine.ts` — linhas 103-111 têm o stub `gateway.long_running_not_supported` que deve ser substituído
- `src/runtime/gateway/gateway.ts` — `Gateway.start()` + `Gateway.stop()` já funcionam; o daemon-run apenas os mantém vivos
- `src/core/event-bus.ts` — `EventBus` já existe; o processo filho cria uma instância nova

**Tech Stack:** TypeScript, Bun, CommandBuilder, EventBus, bun:test.

---

### Task 1: Contrato de daemon no engine

**Files:**
- Modify: `src/features/gateway/engine.ts`
- Test: `src/features/gateway/engine.test.ts`

**Ponto exato de integração:**  
Linhas 103-111 de `engine.ts` têm o stub de erro `gateway.long_running_not_supported`.  
O `GatewayRunInput` precisa de novos campos: `daemon?: "start" | "stop" | "status"` e `pidPath?: string`.

**Step 1: Write failing tests**

```typescript
// src/features/gateway/engine.test.ts
describe("gateway daemon lifecycle", () => {
  it("daemon status returns stopped when no pid file exists", async () => {
    const result = await run({ action: "daemon", daemon: "status", pidPath: "/tmp/gw-test.pid" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mode).toBe("status");
      expect(result.data.running).toBe(false);
    }
  });

  it("daemon start spawns detached process and writes pid", async () => {
    const pidPath = `/tmp/gw-test-${Date.now()}.pid`;
    const result = await run({
      action: "daemon",
      daemon: "start",
      pidPath,
      entrypoint: "index.ts", // bun index.ts gateway daemon-run
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.running).toBe(true);
      expect(result.data.pid).toBeGreaterThan(0);
    }
    // cleanup
    await run({ action: "daemon", daemon: "stop", pidPath });
  });

  it("daemon stop clears pid file", async () => {
    const pidPath = `/tmp/gw-stop-${Date.now()}.pid`;
    // write fake pid
    await Bun.write(pidPath, String(process.pid));
    const result = await run({ action: "daemon", daemon: "stop", pidPath });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.running).toBe(false);
    }
  });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/gateway/engine.test.ts`
Expected: FAIL — `action: "daemon"` não existe no tipo.

**Step 3: Minimal implementation**

Atualizar `GatewayRunInput`:
```typescript
export interface GatewayRunInput {
  action?: "start" | "status" | "daemon";
  daemon?: "start" | "stop" | "status";
  pidPath?: string;
  entrypoint?: string;
  once?: boolean;
  message?: string;
  runner?: GatewayRunner;
  defaultRunnerFactory?: () => Promise<GatewayRunner>;
}
```

Atualizar `GatewayRunResult`:
```typescript
export interface GatewayRunResult {
  mode: "start" | "status" | "daemon";
  running: boolean;
  channels: string[];
  lastResponse?: string;
  pid?: number | null;
}
```

Substituir o stub de erro (linhas 103-111) por:
```typescript
if (action === "daemon") {
  const pidPath = input.pidPath ?? join(process.cwd(), ".nooa", "gateway-daemon.pid");
  const entrypoint = input.entrypoint ?? "index.ts";
  return runDaemonAction(input.daemon ?? "status", pidPath, entrypoint);
}
```

Implementar `runDaemonAction` (mesma lógica de `CronDaemon.startDetached/status/stop`):
```typescript
async function runDaemonAction(
  action: "start" | "stop" | "status",
  pidPath: string,
  entrypoint: string,
): Promise<GatewaySdkResult> {
  // Reusar exatamente o padrão de CronDaemon:
  // - readPid() -> isRunning(pid) -> status
  // - startDetached: Bun.spawn(["bun", entrypoint, "gateway", "daemon-run"], { detached: true })
  // - stop: process.kill(pid, "SIGTERM") + rm(pidPath)
  // ...
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/features/gateway/engine.test.ts`
Expected: PASS

**Step 5: Commit**
`git add src/features/gateway/engine.ts src/features/gateway/engine.test.ts`
`git commit -m "feat(gateway): add daemon lifecycle support in engine"`

---

### Task 2: Expor daemon lifecycle na CLI

**Files:**
- Modify: `src/features/gateway/cli.ts`
- Test: `src/features/gateway/cli.test.ts`

**Ponto exato de integração:**  
O `cli.ts` do gateway usa `CommandBuilder`. Adicionar `--daemon <start|stop|status>` ao schema e ao `parseInput`.

**Step 1: Write failing tests**

```typescript
// src/features/gateway/cli.test.ts
it("parses --daemon status --json", async () => {
  const result = await runCli(["--daemon", "status", "--json"]);
  expect(result.exitCode).toBe(0);
  const json = JSON.parse(result.stdout);
  expect(json.mode).toBe("daemon");
  expect(json.running).toBe(false);
});

it("parses --daemon start --json", async () => {
  // Use a mock engine to avoid spawning real process in tests
  const result = await runCli(["--daemon", "start", "--json"], {
    engineRun: async () => ({ ok: true, data: { mode: "daemon", running: true, channels: ["cli"], pid: 12345 } }),
  });
  expect(result.exitCode).toBe(0);
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/gateway/cli.test.ts`
Expected: FAIL — `--daemon` não existe no schema.

**Step 3: Minimal implementation**
- Adicionar `daemon: { type: "string", required: false }` ao schema.
- No `parseInput`, mapear `values.daemon` para `input.daemon`.
- No `onSuccess`, incluir `pid` no output JSON quando presente.

**Step 4: Verify GREEN**
Run: `bun test ./src/features/gateway/cli.test.ts`
Expected: PASS

**Step 5: Commit**
`git add src/features/gateway/cli.ts src/features/gateway/cli.test.ts`
`git commit -m "feat(gateway): expose daemon start stop status in CLI"`

---

### Task 3: Loop contínuo no processo filho

**Files:**
- Modify: `src/features/gateway/engine.ts`
- Test: `src/features/gateway/engine.test.ts`

**Ponto exato de integração:**  
O processo filho é iniciado com `bun index.ts gateway daemon-run`.  
O `cli.ts` do gateway deve reconhecer `daemon-run` como subaction e chamar `engine.run({ action: "daemon-run" })`.  
O engine então cria `EventBus + Gateway + CliChannel`, chama `gateway.start()` e mantém o loop com `Bun.sleep`.

**Step 1: Write failing test**

```typescript
it("daemon-run starts gateway and holds until abort signal", async () => {
  const controller = new AbortController();
  const mockGatewayStart = mock(async () => {});
  const mockGatewayStop = mock(async () => {});

  // Abort after 50ms to simulate SIGTERM
  setTimeout(() => controller.abort(), 50);

  const result = await run({
    action: "daemon-run",
    signal: controller.signal,
    runner: async () => ({ forLlm: "ok" }),
  });

  expect(mockGatewayStart).toHaveBeenCalled();
  expect(mockGatewayStop).toHaveBeenCalled();
  expect(result.ok).toBe(true);
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/gateway/engine.test.ts`
Expected: FAIL — `action: "daemon-run"` não existe.

**Step 3: Minimal implementation**

```typescript
if (action === "daemon-run") {
  const bus = new EventBus();
  const runner = input.runner ?? (await fallbackFactory());
  const gateway = new Gateway(bus, runner);
  const cliChannel = new CliChannel(bus);
  gateway.registerChannel(cliChannel);
  await gateway.start();

  // Loop até SIGTERM/SIGINT ou AbortSignal
  await new Promise<void>((resolve) => {
    const stop = async () => { await gateway.stop(); resolve(); };
    process.once("SIGTERM", () => void stop());
    process.once("SIGINT", () => void stop());
    input.signal?.addEventListener("abort", () => void stop(), { once: true });
  });

  return { ok: true, data: { mode: "start", running: false, channels: gateway.listChannels() } };
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/features/gateway/engine.test.ts`
Expected: PASS

**Step 5: Commit**
`git add src/features/gateway/engine.ts src/features/gateway/engine.test.ts`
`git commit -m "feat(gateway): add daemon-run continuous loop with graceful shutdown"`

---

### Task 4: Dogfooding and verification

**Step 1:** `bun index.ts gateway --help`
**Step 2:** `bun index.ts gateway --daemon status --json`
**Step 3:** `bun index.ts gateway --daemon start --json`
**Step 4:** `bun index.ts gateway --daemon status --json`
**Step 5:** `bun index.ts gateway --daemon stop --json`
**Step 6:** `bun test ./src/features/gateway/cli.test.ts ./src/features/gateway/engine.test.ts`
