# Pico-Claw Codex

Data: 2026-02-16
Repositorio analisado: `.tmp-picoclaw` (origin `https://github.com/sipeed/picoclaw.git`, commit `32cb8fdc124a0e892b6de7fd20e9e74d2e5c758f`)

## Objetivo
Criar no NOOA um assistente de programacao no nivel de Claude Code, com o "veneno" de PicoClaw/OpenClaw/NanoBot:
- autonomo e orientado a tools
- sempre ligado (gateway + scheduler)
- multi-canal e multi-agente
- memoria persistente util
- leve, modular e evolutivo

## Validacao da superficie real do NOOA (CLI)
Para evitar analise baseada apenas em leitura de codigo, a superficie de comandos foi validada via execucao real:

Comando executado:
- `bun index.ts --help`

Resultado confirmado:
- O NOOA expoe comandos robustos de engenharia e orquestracao (`act`, `ai`, `cron`, `mcp`, `memory`, `run`, `workflow`, `worktree`, entre outros).
- Nao aparece ainda um runtime de agente sempre-on no formato `agent`/`gateway` multi-canal como no PicoClaw.

Como isso impacta a analise:
- As recomendacoes deste documento consideram o NOOA atual como uma CLI avancada e modular.
- O gap central continua sendo a camada de runtime agentico persistente (loop LLM+tools + canais + scheduler autonomo).

## Diagnostico rapido

### Forca atual do NOOA
- Arquitetura modular forte por comando (`src/core/command-builder.ts`, `src/core/registry.ts`).
- Boa base de memoria (`src/features/memory/*`) e reflexao automatica.
- Pipeline de engenharia ja bom (worktree, check, ci, review, guardrail).
- Integracao MCP madura (`src/core/mcp/*`).

### Gap principal para chegar no alvo
NOOA hoje e uma CLI modular poderosa, mas ainda nao e um runtime de agente sempre-on com loop LLM+tools multi-canal.

## O que implementar do PicoClaw (prioridade alta)

### 1) Runtime de agente com loop LLM + tools
Referencia: `pkg/agent/loop.go`, `pkg/tools/toolloop.go`.

Implementar no NOOA:
- loop iterativo de tool calls (ate `max_tool_iterations`)
- `ToolResult` dual: `for_llm` e `for_user`
- persistencia de sessao + resumo automatico
- `processOptions` por tipo de execucao (usuario, heartbeat, sistema)

Impacto: vira agente de verdade, nao apenas comando isolado.

### 2) Tool Registry unificado para agente
Referencia: `pkg/tools/registry.go`.

Implementar no NOOA:
- registry central para tools nativas + MCP
- definicoes de tool geradas de modulos self-describing
- execucao com contexto (channel/chat/session)
- telemetria por tool call

Impacto: camada unica de ferramentas, base para autonomia confiavel.

### 3) Sessao, estado e memoria de conversa
Referencia: `pkg/session/manager.go`, `pkg/state/state.go`, `pkg/agent/context.go`.

Implementar no NOOA:
- `sessions/<channel_chat>.json` com save atomico
- estado da ultima conversa/canal para notificacoes proativas
- prompt context builder com `.nooa/SOUL.md`, `.nooa/USER.md`, `.nooa/MEMORY.md`, `memory/YYYY-MM-DD.md`

Impacto: continuidade real entre mensagens, canais e reinicios.

### 4) Heartbeat + cron realmente autonomos
Referencia: `pkg/heartbeat/service.go`, `pkg/tools/cron.go`, `pkg/cron/service.go`.

Implementar no NOOA:
- daemon de scheduler (nao so CRUD de jobs)
- leitura periodica de `HEARTBEAT.md`
- jobs que disparam agente/tool, nao so log local
- politica `HEARTBEAT_OK` quando nada relevante

Impacto: NOOA passa de reativo para proativo.

### 5) Subagentes (sync e async)
Referencia: `pkg/tools/spawn.go`, `pkg/tools/subagent.go`.

Implementar no NOOA:
- `spawn` (async) para tarefas longas
- `subagent` (sync) para delegacao de sub-problemas
- isolamento de contexto por subagente
- comunicacao de retorno via `message` tool

Impacto: paralelismo e throughput de execucao.

### 6) Sandbox de seguranca por workspace
Referencia: `pkg/tools/filesystem.go`, `pkg/tools/shell.go`.

Implementar no NOOA:
- `restrict_to_workspace` padrao true
- bloqueio de comandos destrutivos e path traversal
- allowlist/denylist no executor

Impacto: autonomia com risco controlado.

## Veneno de OpenClaw para incorporar

Fonte: `https://github.com/openclaw/openclaw` README.

Implementar no NOOA (fase seguinte):
- Gateway como control plane unico (`nooa gateway`).
- Multi-canal real (iniciar com Telegram/Discord; depois Slack/WhatsApp).
- Roteamento multi-agente por canal/usuario/workspace.
- Politica de pareamento/allowlist para DM de origem desconhecida.
- Surface de produto sempre-on (daemon + health + web status minimo).

## Veneno de NanoBot para incorporar

Fonte: `https://github.com/HKUDS/nanobot` README.

Implementar no NOOA:
- manter core pequeno e legivel (evitar runtime inflado)
- onboarding simples (`nooa onboard` completo)
- extensao por skills e providers sem friccao
- foco em operacao rapida e robusta em ambiente limitado

## Arquitetura proposta para o NOOA 2.0

### Camadas
1. `Agent Runtime Kernel`
- loop LLM+tools
- sessao/estado
- resumo automatico

2. `Tool Fabric`
- tools NOOA nativas
- tools MCP
- policy/sandbox

3. `Gateway & Channels`
- adaptadores de canal
- dispatcher inbound/outbound
- roteamento por sessao

4. `Automation Plane`
- cron daemon
- heartbeat service
- subagentes

5. `Memory Plane`
- memoria diaria + duravel
- resumo e recuperacao para prompt

### Sugestao de estrutura
- `src/runtime/agent/*`
- `src/runtime/tools/*`
- `src/runtime/channels/*`
- `src/runtime/scheduler/*`
- `src/runtime/session/*`
- `src/runtime/context/*`

## Roadmap sugerido

### Fase P0 (fundacao, 1-2 semanas)
- Implementar `agent loop` + `tool registry` + `ToolResult dual`.
- Integrar sessao persistente e contexto basico.
- Subir comando `nooa agent` funcional com tools principais.

Criterio de pronto:
- agente resolve tarefas com 2-5 tool calls em uma conversa
- sessao sobrevive reinicio
- memoria/contexto entram no prompt

### Fase P1 (sempre-on, 1-2 semanas)
- Implementar `nooa gateway` + 1 canal (Telegram ou Discord).
- Implementar cron daemon e heartbeat real.
- Implementar `spawn/subagent`.

Criterio de pronto:
- mensagens chegam do canal e voltam resposta
- heartbeat roda periodicamente
- subagente entrega resultado async

### Fase P2 (escala e produto, 2+ semanas)
- Multi-canal adicional
- roteamento multi-agente
- pareamento de seguranca DM
- painel web de status/controle minimo

Criterio de pronto:
- operacao estavel 24/7
- isolamento por sessao/canal
- observabilidade minima (health + logs + eventos)

## Decisoes tecnicas recomendadas
- Reusar `CommandBuilder` como fonte unica para schema de tools.
- Nao acoplar runtime novo ao `act` atual; criar kernel dedicado e depois convergir.
- Integrar MCP como tool source nativo do runtime (nao so chamada pontual em `ai`).
- Padrao de persistencia atomica para sessao/estado.
- Entrega incremental: primeiro confiabilidade, depois canais extras, depois UX avancada.

## Ordem exata de implementacao (pragmatica)
1. `ToolResult dual + registry + runtime loop`
2. `session/state/context builder`
3. `nooa agent`
4. `cron daemon + heartbeat`
5. `spawn/subagent`
6. `gateway + 1 canal`
7. `seguranca DM pairing + multi-agente`

## Conclusao
Se o objetivo e "Claude Code com veneno Claw", o principal nao e adicionar mais comandos.
O principal e transformar NOOA em runtime autonomo, sempre-on, orientado a tools, com sessao/memoria/canais/scheduler.

Hoje, o NOOA ja tem base excelente de engenharia.
O que falta e a camada de execucao agentica permanente.
