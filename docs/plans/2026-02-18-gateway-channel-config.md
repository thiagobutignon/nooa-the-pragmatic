# Gateway Channel Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar configuração tipada de gateway/canais (tokens, allowlist, polling/webhook), mantendo escopo CLI-first e sem implementar adapters externos agora.

**Architecture:** Introduzir módulo de configuração em `src/features/gateway/config.ts` com merge de defaults + env vars e validação mínima. O `gateway engine` consome essa config para comportamento e segurança (allowlist, modo de transporte, bind host/port para evolução futura).

**Tech Stack:** TypeScript, Bun, Zod (opcional), bun:test.

---

### Task 1: Especificar contrato de config

**Files:**
- Create: `src/features/gateway/config.ts`
- Create: `src/features/gateway/config.test.ts`

**Step 1: Write failing tests**
- Validate defaults:
  - `mode=cli`
  - `transport=polling`
  - `allowlist=[]`
  - `host=127.0.0.1`, `port=0` (desabilitado por padrão)
- Validate env overrides (`NOOA_GATEWAY_*`, `NOOA_CHANNELS_CLI_*`).
- Validate parse errors for invalid enum values.

**Step 2: Verify RED**
Run: `bun test ./src/features/gateway/config.test.ts`
Expected: FAIL (missing module).

**Step 3: Minimal implementation**
- Implement `loadGatewayConfig(env = process.env)` with strict typed output.
- Add channel blocks (apenas `cli` ativo; placeholders tipados para telegram/discord desativados).
- Add allowlist parser from comma-separated env.

**Step 4: Verify GREEN**
Run: `bun test ./src/features/gateway/config.test.ts`
Expected: PASS.

**Step 5: Commit**
`git add src/features/gateway/config.ts src/features/gateway/config.test.ts`
`git commit -m "feat(gateway): add typed gateway and channel configuration loader"`

---

### Task 2: Integrar config no engine

**Files:**
- Modify: `src/features/gateway/engine.ts`
- Test: `src/features/gateway/engine.test.ts`

**Step 1: Write failing tests**
- Test engine loads config and includes selected mode in status payload.
- Test allowlist block (when senderId not allowed, message is ignored/logged deterministically).

**Step 2: Verify RED**
Run: `bun test ./src/features/gateway/engine.test.ts`
Expected: FAIL for missing config integration.

**Step 3: Minimal implementation**
- Inject `loadGatewayConfig` into engine run path.
- Thread config into gateway startup and inbound filtering.

**Step 4: Verify GREEN**
Run: `bun test ./src/features/gateway/engine.test.ts`
Expected: PASS.

**Step 5: Commit**
`git add src/features/gateway/engine.ts src/features/gateway/engine.test.ts`
`git commit -m "feat(gateway): consume gateway config in engine runtime"`

---

### Task 3: Atualizar documentação operacional

**Files:**
- Modify: `.env.example`
- Modify: `docs/plans/2026-02-16-phase-3-gateway-channels-tui.md`

**Step 1: Add config variables docs**
- Document `NOOA_GATEWAY_MODE`, `NOOA_GATEWAY_TRANSPORT`, `NOOA_GATEWAY_ALLOWLIST`, `NOOA_GATEWAY_HOST`, `NOOA_GATEWAY_PORT`.

**Step 2: Verify**
- Run: `bun run check:changed`

**Step 3: Commit**
`git add .env.example docs/plans/2026-02-16-phase-3-gateway-channels-tui.md`
`git commit -m "docs(gateway): document channel and gateway configuration variables"`
