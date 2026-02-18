# Gateway Observability and Operations Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar observabilidade e operação mínima do gateway (health, métricas simples, reconexão/backoff, supervisão de processo).

**Architecture:** Reusar patterns existentes de health/status em comandos internos e expor telemetria do gateway via status estruturado + endpoint HTTP opcional local. A camada de operação fica em módulos pequenos sob `src/features/gateway/` e `src/runtime/gateway/`.

**Tech Stack:** TypeScript, Bun HTTP server, EventBus, bun:test.

---

### Task 1: Health model e status rico

**Files:**
- Create: `src/runtime/gateway/health.ts`
- Create: `src/runtime/gateway/health.test.ts`
- Modify: `src/features/gateway/engine.ts`

**Step 1: Write failing tests**
- Health payload must include:
  - `uptimeMs`
  - `channels` with state
  - `lastInboundAt` / `lastOutboundAt`
  - `queueDepth` (if applicable)

**Step 2: Verify RED**
Run: `bun test ./src/runtime/gateway/health.test.ts`
Expected: FAIL.

**Step 3: Minimal implementation**
- Implement `GatewayHealthState` and updates from runtime events.
- Return this model in `gateway status --json`.

**Step 4: Verify GREEN**
Run: `bun test ./src/runtime/gateway/health.test.ts ./src/features/gateway/engine.test.ts`
Expected: PASS.

**Step 5: Commit**
`git add src/runtime/gateway/health.ts src/runtime/gateway/health.test.ts src/features/gateway/engine.ts`
`git commit -m "feat(gateway): add structured health state and status payload"`

---

### Task 2: Endpoint de health opcional

**Files:**
- Create: `src/features/gateway/health-server.ts`
- Create: `src/features/gateway/health-server.test.ts`
- Modify: `src/features/gateway/engine.ts`

**Step 1: Write failing tests**
- Endpoint `/healthz` returns JSON 200 when gateway healthy.
- Endpoint disables when env/flag disabled.

**Step 2: Verify RED**
Run: `bun test ./src/features/gateway/health-server.test.ts`
Expected: FAIL.

**Step 3: Minimal implementation**
- Start lightweight Bun server bound to `127.0.0.1` only.
- Serve health payload from gateway state.

**Step 4: Verify GREEN**
Run: `bun test ./src/features/gateway/health-server.test.ts`
Expected: PASS.

**Step 5: Commit**
`git add src/features/gateway/health-server.ts src/features/gateway/health-server.test.ts src/features/gateway/engine.ts`
`git commit -m "feat(gateway): add optional local health endpoint"`

---

### Task 3: Reconexão/backoff e supervisão

**Files:**
- Create: `src/runtime/gateway/supervisor.ts`
- Create: `src/runtime/gateway/supervisor.test.ts`
- Modify: `src/features/gateway/engine.ts`

**Step 1: Write failing tests**
- Simulate channel start failure and assert retry with exponential backoff.
- Assert max retry cap and degraded status.

**Step 2: Verify RED**
Run: `bun test ./src/runtime/gateway/supervisor.test.ts`
Expected: FAIL.

**Step 3: Minimal implementation**
- Implement retry policy (`initialMs`, `maxMs`, `maxAttempts`).
- Wire supervisor around channel startup in daemon mode.

**Step 4: Verify GREEN**
Run: `bun test ./src/runtime/gateway/supervisor.test.ts ./src/features/gateway/engine.test.ts`
Expected: PASS.

**Step 5: Commit**
`git add src/runtime/gateway/supervisor.ts src/runtime/gateway/supervisor.test.ts src/features/gateway/engine.ts`
`git commit -m "feat(gateway): add channel supervisor with retry backoff"`

---

### Scope note
- Este plano **não** inclui adapters reais de Telegram/Discord agora (decisão atual: interface principal é CLI).
- Este plano **não** inclui provider `claude-cli` (NOOA já substitui esse fluxo).
