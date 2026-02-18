# Gap Analysis: NOOA → Agente de Codificação de Próxima Geração

> **Data:** 2026-02-18  
> **Objetivo:** Mapear o que já foi implementado, o que falta, e o que pode ser reaproveitado para que o sistema funcione de ponta a ponta como um agente de codificação autônomo, persistente e multi-canal — concorrente do Claude Code e Codex.

---

## 1. Estado Atual: O Que Já Temos

### 1.1 CLI Surface (38+ comandos)

O NOOA já expõe uma CLI rica e funcional:

```
act, agent, ai, ask, check, ci, code, commit, context, cron,
doctor, embed, eval, fix, gate, gateway, goal, guardrail,
identity, ignore, index, init, mcp, memory, message, pr,
prompt, push, pwd, read, replay, review, run, scaffold,
search, skills, tui, workflow, worktree
```

**Todos os 38+ comandos estão registrados e funcionais.** 825 testes passando, 0 falhas.

### 1.2 Runtime Agentic (src/runtime/) — Fases 0-3 Parcialmente Implementadas

| Módulo | Arquivos | Status |
|--------|----------|--------|
| `types.ts` + `tool-registry.ts` | 4 arquivos | ✅ Completo (Phase 0) |
| `security/command-guard.ts` | 2 arquivos | ✅ Completo (Phase 0) |
| `session/manager.ts` | 2 arquivos | ✅ Completo (Phase 1) |
| `context/builder.ts` | 2 arquivos | ✅ Completo (Phase 1) |
| `agent/loop.ts` + `provider.ts` | 4 arquivos | ✅ Completo (Phase 1) |
| `heartbeat/service.ts` | 2 arquivos | ✅ Completo (Phase 2) |
| `tools/spawn.ts` + `subagent.ts` | 4 arquivos | ✅ Completo (Phase 2) |
| `channels/channel.ts` + `cli-channel.ts` | 3 arquivos | ✅ Completo (Phase 3) |
| `gateway/gateway.ts` + `messages.ts` | 4 arquivos | ✅ Completo (Phase 3) |

### 1.3 Features CLI (src/features/)

| Feature | Arquivos | Destaque |
|---------|----------|----------|
| `agent/` | 4 | CLI + engine usando AgentLoop |
| `gateway/` | 4 | CLI + engine com EventBus + CliChannel |
| `cron/` | 5 | CLI + daemon + service (SQLite) |
| `ai/providers/` | 7 | ollama, openai, groq, mock |
| `mcp/` | 32 | Integração MCP madura |
| `code/` | 16 | write/patch/diff/format/refactor/delete |
| `prompt/` | 24 | Sistema de prompts versionado |
| `guardrail/` | 17 | Profiles YAML, validação |
| `eval/` | 11 | Suite de avaliação sistemática |

### 1.4 TUI (src/tui/)

- **32 hooks** implementados (`useAi`, `useAct`, `useCode`, etc.)
- **Sem screens/componentes React/Ink** ainda (apenas hooks)

---

## 2. O Que Falta: Gaps Críticos para Funcionar de Ponta a Ponta

### 🔴 GAP 1: Gateway não tem modo daemon real

**Situação atual:**  
`nooa gateway start` tem o erro `gateway.long_running_not_supported`. O gateway só funciona com `--once` (processa uma mensagem e para).

**O que falta:**
- Loop de escuta contínua no `src/features/gateway/engine.ts`
- Integração com `CronDaemon` para manter o processo vivo
- Reconexão automática em caso de falha de canal

**Impacto:** Sem isso, o sistema não é "sempre-on". É reativo, não proativo.

**Reaproveitamento:** `CronDaemon` já existe em `src/features/cron/daemon.ts`. O gateway pode usar o mesmo padrão de loop com `setInterval`.

---

### 🔴 GAP 2: Heartbeat não está conectado ao AgentLoop

**Situação atual:**  
`HeartbeatService` (`src/runtime/heartbeat/service.ts`) lê o `HEARTBEAT.md` e monta o prompt, mas **não executa via AgentLoop**. É um serviço isolado sem executor.

**O que falta:**
- Integração do `HeartbeatService` com `AgentLoop` no `CronDaemon`
- Job nativo `__system_heartbeat__` no cron que dispara o AgentLoop com o prompt do heartbeat
- Roteamento do resultado para o último canal ativo

**Impacto:** O NOOA não tem proatividade real. Não monitora, não age por conta própria.

**Reaproveitamento:** `CronDaemon` + `AgentLoop` + `HeartbeatService` já existem. Falta apenas o "fio" que os conecta.

---

### 🔴 GAP 3: Spawn/Subagent não estão registrados no AgentLoop

**Situação atual:**  
`spawn.ts` e `subagent.ts` existem em `src/runtime/tools/`, mas **não estão registrados no ToolRegistry** do AgentLoop. O agente não pode delegar tarefas.

**O que falta:**
- Registrar `spawn` e `subagent` como tools no `AgentLoop` via `engine.ts`
- Anti-recursion guard: spawn não pode chamar spawn
- Comunicação de retorno via `message` tool

**Impacto:** O agente não tem paralelismo. Tarefas longas bloqueiam o loop principal.

**Reaproveitamento:** `ToolRegistry` já suporta registro dinâmico. `AgentLoop` já tem o padrão de tool execution.

---

### 🔴 GAP 4: Sem ClaudeCliProvider (CLI-as-Provider)

**Situação atual:**  
`src/features/ai/providers/` tem: `ollama`, `openai`, `groq`, `mock`. **Não tem `claude-cli`**.

**O que falta:**
- `src/features/ai/providers/claude-cli.ts` — wrapa `claude -p --output-format json` como subprocess
- `src/features/ai/providers/codex-cli.ts` — wrapa `codex` CLI (opcional)
- Registro no `AiEngine` como provider selecionável via `--provider claude-cli`

**Impacto:** Não consegue usar Claude Code ou Codex como backend LLM. Dependente de API keys diretas.

**Reaproveitamento:** Padrão de provider já existe (interface `AiProvider`). Basta implementar o adapter.

---

### 🟡 GAP 5: TUI sem tela de chat agentic

**Situação atual:**  
`src/tui/hooks/` tem 32 hooks, mas **não há screens React/Ink**. O comando `nooa tui` existe mas não tem interface de chat.

**O que falta:**
- `src/tui/screens/chat/ChatScreen.tsx` — tela principal de chat
- `src/tui/screens/chat/MessageList.tsx` — lista de mensagens (user/assistant/tool)
- `src/tui/screens/chat/InputBar.tsx` — barra de input
- `src/tui/hooks/useAgent.ts` — hook que conecta TUI ao AgentLoop via EventBus

**Impacto:** A experiência de usuário é puramente CLI. Sem a TUI de chat, o produto não compete com Claude Code visualmente.

**Reaproveitamento:** Todos os hooks existentes podem alimentar a TUI. O `EventBus` já existe para comunicação.

---

### 🟡 GAP 6: Semantic Search não está otimizado

**Situação atual:**  
O plano `2026-02-11-semantic-search-option-a.md` define 5 tarefas de melhoria (chunking estrutural, batch embeddings, cache LRU, golden-set tests, unificação de defaults). **Nenhuma foi implementada ainda.**

**O que falta:**
- Structure-aware chunking em `src/features/index/execute.ts`
- Batch embeddings (1 chamada por arquivo, não por chunk)
- Cache LRU para query embeddings
- Testes de qualidade com fixtures determinísticas
- Unificação de defaults entre `ask`, `context`, `prompt`

**Impacto:** Busca semântica com qualidade inferior. Custo de embeddings desnecessariamente alto.

**Reaproveitamento:** `executeSearch`, `embedText`, SQLite store — tudo existe. São melhorias incrementais.

---

### 🟡 GAP 7: Telegram/Discord Channel não implementado

**Situação atual:**  
`src/runtime/channels/` tem apenas `cli-channel.ts`. **Sem canais externos.**

**O que falta:**
- `src/runtime/channels/telegram-channel.ts` — usando `node-telegram-bot-api`
- `src/runtime/channels/discord-channel.ts` — usando `discord.js`
- Registro no Gateway como canais opcionais (via config)
- DM pairing/allowlist para segurança

**Impacto:** O sistema é CLI-only. Sem multi-canal, não compete com PicoClaw em alcance.

**Reaproveitamento:** `Channel` interface já definida. `Gateway` já suporta `registerChannel()`. É só implementar os adapters.

---

### 🟢 GAP 8: Web Search Tool não existe

**Situação atual:**  
`nooa search` busca arquivos locais. **Sem busca na web.**

**O que falta:**
- `src/runtime/tools/web-search.ts` — Brave Search API + DuckDuckGo fallback
- `src/runtime/tools/web-fetch.ts` — fetch de URL com extração de texto
- Registro no ToolRegistry do AgentLoop

**Impacto:** O agente não pode pesquisar informações externas. Limitado ao contexto local.

**Reaproveitamento:** `ToolRegistry` já suporta registro. Padrão de tool já definido.

---

### 🟢 GAP 9: Security Sandbox (workspace restriction) não implementado

**Situação atual:**  
`DangerousCommandGuard` bloqueia comandos destrutivos, mas **não há restrição de workspace** (path traversal, acesso fora do projeto).

**O que falta:**
- `restrict_to_workspace: true` como opção no `ToolRegistry`
- Validação de paths em file tools (read, write, exec)
- Herança de restrição para subagentes

**Impacto:** Autonomia sem sandbox completo. Risco em produção.

**Reaproveitamento:** `DangerousCommandGuard` já existe. É uma extensão natural.

---

## 3. O Que Pode Ser Reaproveitado em Novas Funcionalidades

### 3.1 CommandBuilder → Tool Schema para AgentLoop

O `CommandBuilder` (`src/core/command-builder.ts`) já gera `AgentDoc` com schema estruturado. **Pode ser usado para gerar automaticamente as `ToolDefinition` do ToolRegistry** a partir dos 38 comandos existentes.

```typescript
// Ideia: cada feature vira uma tool do agente automaticamente
const toolDef = commandToToolDefinition(agentBuilder.buildAgentDoc());
registry.register(toolDef);
```

**Impacto:** O agente ganha acesso a todos os 38 comandos como tools sem esforço adicional.

---

### 3.2 MCP como Tool Source Nativo

`src/features/mcp/` tem 32 arquivos de integração MCP madura. **Pode alimentar o ToolRegistry do AgentLoop diretamente**, tornando qualquer servidor MCP disponível como tool para o agente.

```typescript
// Ideia: MCP tools registradas automaticamente no AgentLoop
const mcpTools = await mcpEngine.listTools();
for (const tool of mcpTools) registry.register(mcpToToolDefinition(tool));
```

---

### 3.3 Memory System → Context Builder

`src/features/memory/` já tem busca semântica de memórias. O `ContextBuilder` (`src/runtime/context/builder.ts`) pode **incluir memórias relevantes no system prompt** automaticamente.

---

### 3.4 Eval Suite → Benchmark do AgentLoop

`src/features/eval/` tem 11 arquivos de avaliação sistemática. Pode ser usado para **medir a qualidade do AgentLoop** (taxa de sucesso em tarefas, número de iterações, custo de tokens).

---

### 3.5 Guardrail → Policy Layer do AgentLoop

`src/features/guardrail/` tem 17 arquivos de verificação de políticas YAML. Pode ser usado como **camada de validação antes de executar tools** no AgentLoop (ex: guardrail antes de `code write`).

---

### 3.6 EventBus → Bridge TUI ↔ AgentLoop

`src/core/event-bus.ts` já existe e é usado pelo Gateway. Os 32 hooks da TUI podem **subscrever eventos do AgentLoop via EventBus** para atualizar a interface em tempo real.

---

## 4. Roadmap de Implementação (Ordem Pragmática)

### Sprint 1: Fechar o Loop Agentico (1-2 semanas)

| # | Tarefa | Gap | Esforço |
|---|--------|-----|---------|
| 1 | Registrar spawn/subagent no AgentLoop | GAP 3 | Baixo |
| 2 | Conectar HeartbeatService ao CronDaemon via AgentLoop | GAP 2 | Médio |
| 3 | Implementar ClaudeCliProvider | GAP 4 | Médio |
| 4 | Modo daemon real no Gateway (loop contínuo) | GAP 1 | Médio |

**Critério de pronto:** `nooa agent "analise este repo"` resolve com tool calls reais. `nooa gateway start` roda indefinidamente. Heartbeat dispara a cada 30min.

---

### Sprint 2: TUI de Chat + Semantic Search (1-2 semanas)

| # | Tarefa | Gap | Esforço |
|---|--------|-----|---------|
| 5 | ChatScreen + MessageList + InputBar (Ink.js) | GAP 5 | Alto |
| 6 | useAgent hook conectando TUI ao AgentLoop | GAP 5 | Médio |
| 7 | Structure-aware chunking + batch embeddings | GAP 6 | Médio |
| 8 | Cache LRU para query embeddings | GAP 6 | Baixo |

**Critério de pronto:** `nooa tui` abre chat interativo com o agente. Busca semântica com qualidade mensurável.

---

### Sprint 3: Multi-Canal + Segurança (2+ semanas)

| # | Tarefa | Gap | Esforço |
|---|--------|-----|---------|
| 9 | TelegramChannel adapter | GAP 7 | Médio |
| 10 | Workspace restriction sandbox | GAP 9 | Médio |
| 11 | Web Search + Web Fetch tools | GAP 8 | Médio |
| 12 | CommandBuilder → ToolDefinition auto-bridge | Reaproveitamento 3.1 | Alto |

**Critério de pronto:** Mensagens chegam do Telegram e voltam resposta. Agente não acessa arquivos fora do workspace.

---

## 5. Diagrama: Estado Atual vs. Estado Alvo

```
ESTADO ATUAL (2026-02-18)
─────────────────────────
CLI (38 comandos) ──► AgentLoop ──► ToolRegistry (tools básicas)
                                         │
                         SessionManager ◄┘
                         ContextBuilder
                         HeartbeatService (isolado, sem executor)
                         spawn/subagent (não registrados)
                         Gateway (--once only)
                         TUI (hooks sem screens)
                         AI Providers: ollama/openai/groq/mock

ESTADO ALVO (Sprint 3)
──────────────────────
TUI ChatScreen ──► EventBus ──► Gateway (daemon) ──► AgentLoop
                                    │                    │
                              Telegram/Discord     ToolRegistry
                              CLI Channel              │
                                                  ┌────┴────────────────┐
                                                  │  38 CLI commands     │
                                                  │  MCP tools           │
                                                  │  spawn/subagent      │
                                                  │  web-search/fetch    │
                                                  │  code/fix/pr/review  │
                                                  └──────────────────────┘
                                                       │
                                              CronDaemon + Heartbeat
                                              SessionManager (persistente)
                                              ContextBuilder (SOUL+memory)
                                              ClaudeCliProvider
                                              SecuritySandbox
```

---

## 6. Princípio CLI-First: Como Aplicar em Cada Gap

Seguindo o princípio **CLI-First** do projeto:

1. **GAP 1 (Gateway daemon):** Implementar `nooa gateway start --daemon` que roda o loop. Testar com `--once` primeiro. Verificar via `nooa gateway status --json`.

2. **GAP 2 (Heartbeat):** Implementar `nooa cron heartbeat --trigger` para disparar manualmente. Depois integrar ao daemon. Verificar via `bun test src/runtime/heartbeat/`.

3. **GAP 3 (Spawn/Subagent):** Implementar `nooa agent "spawn: analise este arquivo"` e verificar que o agente delega. Testar via CLI antes de qualquer TUI.

4. **GAP 4 (ClaudeCliProvider):** Implementar `nooa ai --provider claude-cli "hello"` e verificar stdout. Testar com `--json` para schema estável.

5. **GAP 5 (TUI):** Implementar `nooa tui chat` como comando CLI primeiro (stdin/stdout), depois migrar para Ink.js.

---

## 7. Conclusão

O NOOA já tem **a base mais sólida possível**: 38 comandos, runtime agentico com todas as peças (AgentLoop, SessionManager, ContextBuilder, ToolRegistry, HeartbeatService, spawn/subagent, Gateway, channels), 825 testes passando.

**O que falta não é construir — é conectar.**

Os 4 gaps críticos (Gateway daemon, Heartbeat→AgentLoop, Spawn registrado, ClaudeCliProvider) podem ser fechados em 1-2 semanas. Com isso, o NOOA passa de uma CLI avançada para um **runtime agentico sempre-on**, capaz de:

- Receber mensagens de múltiplos canais
- Executar tool calls com as 38+ ferramentas de desenvolvimento
- Delegar subtarefas a subagentes
- Agir proativamente via heartbeat
- Usar Claude Code como backend LLM via CLI wrapper

**A fusão já está 70% feita. Os 30% restantes são os fios de conexão.**
