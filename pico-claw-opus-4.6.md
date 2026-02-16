# PicoClaw vs NOOA — Análise Opus 4.6

> **Objetivo:** Extrair o "veneno" do PicoClaw para potencializar o NOOA, criando um assistente de programação que combina as capacidades do Claude Code com a arquitetura agentic eficiente do PicoClaw.

---

## 1. Visão Geral: Os Dois Projetos

### NOOA — The Pragmatic (TypeScript/Bun)

| Atributo | Valor |
|----------|-------|
| **Linguagem** | TypeScript |
| **Runtime** | Bun |
| **Versão** | 1.6.1 |
| **Subcomandos** | **38 comandos** |
| **Features dirs** | **37 módulos** |
| **Linter** | Biome (strict `noExplicitAny`) |
| **Testes** | bun:test (coverage target 75%) |
| **DB** | SQLite (embeddings + cosine similarity) |
| **CLI Framework** | Custom (self-describing modules) |
| **Prompt System** | Modular, namespace-isolated, versionado |
| **TUI** | Ink.js/React |

### PicoClaw (Go)

| Atributo | Valor |
|----------|-------|
| **Linguagem** | Go 1.21+ |
| **Binary** | Single self-contained |
| **RAM** | <10MB |
| **Boot** | <1s (0.6GHz) |
| **Source files** | 97 `.go` em 19 pacotes |
| **Canais** | 10 (Telegram, Discord, Slack, LINE, etc.) |
| **DB** | Flat files (JSON/Markdown) |
| **Prompt System** | Markdown files (SOUL.md, IDENTITY.md, etc.) |
| **Hardware** | I2C/SPI (Linux IoT) |

---

## 2. Comparação Funcional: Feature por Feature

### 2.1 Comandos NOOA (38) vs Funcionalidades PicoClaw

| Categoria | NOOA | PicoClaw | Vencedor |
|-----------|------|----------|----------|
| **Agent autônomo** | `act` — orchestrator multi-turn com AgentDocs | Agent Loop iterativo com maxIterations | 🟨 Empate (abordagens diferentes) |
| **AI direta** | `ai` — query engine multi-provider | Chat via provider (HTTP/CLI/SDK) | **NOOA** (12 arquivos, multi-provider integrado) |
| **Busca semântica** | `ask` — cosine similarity em SQLite | ❌ Não tem | **NOOA** |
| **Código** | `code` — write/patch/diff/format/refactor/delete (16 arquivos!) | `write_file`, `edit_file`, `read_file` (tools básicas) | **NOOA** (muito mais rico) |
| **Bug fix autônomo** | `fix` — worktree → context → patch → verify → commit | ❌ Não tem | **NOOA** |
| **PR Management** | `pr` — create/list/review/merge/close/comment/status | ❌ Não tem | **NOOA** |
| **Code Review** | `review` — AI-powered review | ❌ Não tem | **NOOA** |
| **CI local** | `ci` — test + lint + check pipeline | ❌ Não tem | **NOOA** |
| **Commit validation** | `commit` — TDD check, forbidden markers | ❌ Não tem | **NOOA** |
| **Push** | `push` — remote push with validation | ❌ Não tem | **NOOA** |
| **Guardrails** | `guardrail` — YAML profile checks (17 arquivos!) | Safety guards no `exec` tool | **NOOA** (muito mais sofisticado) |
| **Quality Gates** | `gate` — verify project state | ❌ Não tem | **NOOA** |
| **Goals** | `goal` — scope management, anti-scope-creep | ❌ Não tem | **NOOA** |
| **Eval Suite** | `eval` — systematic prompt evaluation (11 arquivos) | ❌ Não tem | **NOOA** |
| **Prompt System** | `prompt` — list/view/validate/render/create/edit/delete/publish (24 arquivos!) | System prompt construído de markdown files | **NOOA** (versionado, publicável) |
| **Context Pack** | `context` — AI context generation | Context Builder (identity + skills + memory) | 🟨 Empate |
| **Embeddings** | `embed` — text/file embedding | ❌ Não tem (usa provider direto) | **NOOA** |
| **Indexing** | `index` — semantic indexing + search | ❌ Não tem | **NOOA** |
| **Memory** | `memory` — add/search/promote/get/summarize | Memory Store (MEMORY.md + daily notes) | 🟨 Empate (abordagens complementares) |
| **Cron/Schedule** | `cron` — recurring jobs | `cron` tool + Heartbeat service + HEARTBEAT.md | **PicoClaw** (heartbeat é mais poderoso) |
| **MCP** | `mcp` — init/list/install/enable/disable/call/health (32 arquivos!) | ❌ Não tem | **NOOA** |
| **Scaffold** | `scaffold` — standardize feature/prompt creation | ❌ Não tem | **NOOA** |
| **Search** | `search` — files + contents | ❌ (usa `exec` com grep) | **NOOA** |
| **Read** | `read` — file reading | `read_file` tool | 🟨 Empate |
| **Skills** | `skills` — manage skills | Skills Loader (3-tier: workspace/global/builtin) | 🟨 Empate |
| **Worktree** | `worktree` — git worktree management | ❌ Não tem | **NOOA** |
| **Replay** | `replay` — step graph for agent workflows | ❌ Não tem | **NOOA** |
| **Run** | `run` — multi-command pipeline | `exec` tool (single command) | **NOOA** |
| **Identity** | `init`/`identity` — agentic soul & identity | SOUL.md + IDENTITY.md + USER.md + AGENT.md | 🟨 Empate |
| **Ignore** | `ignore` — .nooa-ignore patterns | ❌ Não tem | **NOOA** |
| **Doctor** | `doctor` — environment health check | ❌ Não tem | **NOOA** |
| **TUI** | `tui` — terminal UI com Ink.js | ❌ (CLI puro) | **NOOA** |
| **Workflow** | `workflow` — verification sequence | ❌ Não tem | **NOOA** |
| **Check** | `check` — Zero-Preguiça audit | ❌ Não tem | **NOOA** |
| **Message** | `message` — send to AI agent | `message` tool (multi-channel) | **PicoClaw** (multi-canal) |
| **Web Search** | ❌ Não tem como comando | `web_search` + `web_fetch` tools | **PicoClaw** |
| **Subagents** | ❌ Não tem | `spawn` (async) + `subagent` (sync) | **PicoClaw** |
| **Multi-Channel** | ❌ CLI only | 10 canais (Telegram, Discord, Slack, etc.) | **PicoClaw** |
| **Hardware IoT** | ❌ Não tem | `i2c` + `spi` tools (Linux) | **PicoClaw** |
| **CLI-as-Provider** | ❌ Não tem | Claude CLI + Codex CLI como providers | **PicoClaw** |
| **Security Sandbox** | ❌ Não tem | Workspace restriction + command blocklist | **PicoClaw** |

### Placar Final

| | NOOA | PicoClaw | Empate |
|--|------|----------|--------|
| **Features** | **23** | **7** | **7** |

> **Conclusão:** NOOA é drasticamente mais rico em features de desenvolvimento. PicoClaw brilha em infraestrutura agentic (subagents, multi-canal, heartbeat, security sandbox, CLI-as-provider).

---

## 3. O Que PicoClaw Tem e NOOA Precisa

### 🔴 Prioridade Crítica — Adotar Agora

#### 3.1 ToolResult Dual-Output (`ForLLM` / `ForUser` / `Silent` / `Async`)

**O que é:** Cada ferramenta retorna dois outputs — um para o LLM processar (técnico, detalhado) e outro para o usuário ver (limpo, resumido). Flags extras controlam se o resultado é silencioso ou assíncrono.

**PicoClaw:**
```go
type ToolResult struct {
    ForLLM  string  // Contexto técnico para o LLM
    ForUser string  // Mensagem limpa para o usuário
    Silent  bool    // Suprime mensagem ao usuário
    IsError bool    // Flag de erro
    Async   bool    // Rodando em background
    Err     error   // Erro interno (excluído do JSON)
}
```

**NOOA hoje:** Returns com `CommandResult` simples (`ok`, `data`, `errorCode`).

**Impacto:** O LLM recebe informação técnica rica enquanto o usuário vê um resumo limpo. Reduz ruído na interface. Fundamental para operações background.

---

#### 3.2 Dangerous Command Blocklist

**O que é:** Lista hardcoded de comandos perigosos bloqueados mesmo com sandbox desabilitado.

**Bloqueados sempre:**
- `rm -rf`, `del /f`, `rmdir /s` — Deleção em massa
- `format`, `mkfs`, `diskpart` — Formatação de disco
- `dd if=` — Image de disco
- `/dev/sd[a-z]` — Escrita direta em disco
- `shutdown`, `reboot`, `poweroff` — Desligamento
- Fork bomb `:(){ :|:& };:`

**NOOA hoje:** Sem proteção contra comandos destrutivos no `code` ou `run`.

---

#### 3.3 Atomic Session Saves

**O que é:** Padrão write → fsync → rename para salvar sessões de forma crash-safe.

```go
// PicoClaw pattern
tmpFile → Write(data) → Chmod(0644) → Sync() → Close() → Rename(tmp, final)
```

**NOOA hoje:** `Store.ts` usa SQLite (já tem transações), mas a lógica de salvamento de sessão pode não ser atômica.

---

#### 3.4 Oversized Message Guard

**O que é:** Durante sumarização, mensagens maiores que 50% do context window são ignoradas para evitar overflow.

**NOOA hoje:** Memory compaction não tem guard contra mensagens enormes.

---

### 🟡 Prioridade Alta — Planejar para v2

#### 3.5 Sistema de Subagents

**O que é:** Duas modalidades de delegação:

| | `spawn` (Async) | `subagent` (Sync) |
|--|---|---|
| **Execução** | Background (goroutine) | Bloqueante |
| **Retorno** | `AsyncResult` imediato | Resultado completo |
| **Comunicação** | Via `message` tool | Via `ToolResult` |
| **Tool access** | Próprio ToolRegistry (sem spawn/subagent para evitar recursão) | Próprio ToolRegistry |
| **Max iterations** | 10 | 10 |

**NOOA hoje:** `act` já tem um agent loop, mas não delega subtasks a sub-agentes independentes.

**Integração sugerida:** Criar `nooa spawn "task"` e `nooa delegate "task"` como novos comandos.

---

#### 3.6 Heartbeat Service

**O que é:** Serviço periódico que lê `HEARTBEAT.md` e executa tarefas proativamente.

```
Ticker (30min) → Lê HEARTBEAT.md → Executa via agent → Roteia para último canal ativo
```

**Key behaviors:**
- Sem histórico de sessão (previne bloat)
- Tarefas complexas delegadas via `spawn` (async)
- Canal de destino = último canal ativo do usuário
- Template default criado automaticamente

**NOOA hoje:** Tem `cron` mas sem proatividade baseada em markdown editável pelo usuário.

---

#### 3.7 CLI-as-Provider

**O que é:** Usa CLIs existentes (claude, codex) como providers LLM via subprocess.

```go
// ClaudeCliProvider
cmd := exec.Command("claude", "-p", "--output-format", "json", 
                     "--dangerously-skip-permissions", "--no-chrome")
cmd.Stdin = bytes.NewReader([]byte(prompt))
```

**NOOA hoje:** AiEngine suporta Ollama, OpenAI, Mock — mas não wrapa CLIs.

**Integração sugerida:** Criar `ClaudeCodeProvider` que wrapa `claude` CLI como provider do AiEngine.

---

#### 3.8 Multi-Channel Gateway

**O que é:** 10 canais de comunicação via MessageBus.

**NOOA hoje:** CLI only. O EventBus existe mas não tem channels externos.

**Integração sugerida:** Começar com Telegram (mais simples), depois Discord.

---

### 🟢 Nice-to-Have

#### 3.9 Web Search/Fetch Tools

Brave Search API + DuckDuckGo fallback + URL fetch with text extraction.

**NOOA hoje:** Sem busca web integrada.

#### 3.10 Hardware Tools (I2C/SPI)

Linux-only para IoT. Skip para NOOA.

#### 3.11 GitHub Copilot Provider

Via SDK oficial (gRPC). Alternativa de LLM backend.

---

## 4. O Que NOOA Tem e PicoClaw Não Tem (Nosso "Veneno")

### 🏆 Features Exclusivas do NOOA

| Feature | Profundidade | Arquivos |
|---------|-------------|----------|
| **Autonomous Bug Fix** (`fix`) | Worktree → context → patch → verify → commit | 5 |
| **PR Management** (`pr`) | Create/list/review/merge/close/comment/status | 4 |
| **Code Operations** (`code`) | Write/patch/diff/format/refactor/delete | **16** |
| **Guardrails** (`guardrail`) | YAML profiles, schema validation | **17** |
| **Eval Suite** (`eval`) | Systematic prompt evaluation | **11** |
| **Prompt System** (`prompt`) | Versionado, list/view/validate/render/create/edit/delete/publish | **24** |
| **MCP Integration** (`mcp`) | Init/list/install/enable/disable/call/health | **32** |
| **Quality Gates** (`gate`) | Project state verification | 4 |
| **Code Review** (`review`) | AI-powered review | 5 |
| **CI Pipeline** (`ci`) | Test + lint + check | 4 |
| **Commit Validation** (`commit`) | TDD check, forbidden markers | 3 |
| **Scaffolding** (`scaffold`) | Feature/prompt templates | 7 |
| **Semantic Index** (`index`) | Vector embeddings + search | 6 |
| **Embeddings** (`embed`) | Text/file embedding | 4 |
| **Worktree Management** (`worktree`) | Git worktree lifecycle | 6 |
| **Replay/Step Graph** (`replay`) | Agent workflow tracking | 5 |
| **Goals** (`goal`) | Scope management, anti-scope-creep | 4 |
| **Doctor** (`doctor`) | Environment health check | 4 |
| **Context Pack** (`context`) | AI context generation | 6 |
| **Run Pipeline** (`run`) | Multi-command execution | 5 |
| **TUI** (`tui`) | Terminal UI com Ink.js/React | 3 |
| **Workflow** (`workflow`) | Gate verification sequences | 2 |
| **Check/Zero-Preguiça** (`check`) | Code audit against policies | 1 |

**Total: ~170+ arquivos em features que PicoClaw não tem.**

---

## 5. Arquitetura Comparada

```
┌──────────────────────────────────────────────────────────────────┐
│  NOOA (TypeScript/Bun) — 38 comandos, 37 features, 170+ files  │
│                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌──────────────┐                │
│  │   CLI   │───▶│ EventBus │───▶│  ActEngine   │                │
│  │ (Yargs) │    │          │    │  (agent loop) │                │
│  └─────────┘    └──────────┘    └──────┬───────┘                │
│       │                                 │                        │
│  ┌────▼──────────────────────────┐  ┌──▼────────┐              │
│  │     37 Feature Modules        │  │ AiEngine  │              │
│  │ ┌──────┐ ┌────┐ ┌─────────┐  │  │(Ollama/   │              │
│  │ │ code │ │ pr │ │guardrail│  │  │ OpenAI/   │              │
│  │ │ (16) │ │(4) │ │  (17)   │  │  │ Mock)     │              │
│  │ └──────┘ └────┘ └─────────┘  │  └───────────┘              │
│  │ ┌──────┐ ┌────┐ ┌─────────┐  │                              │
│  │ │prompt│ │eval│ │  mcp    │  │  ┌───────────┐              │
│  │ │ (24) │ │(11)│ │  (32)   │  │  │  Store    │              │
│  │ └──────┘ └────┘ └─────────┘  │  │ (SQLite)  │              │
│  │ ┌──────┐ ┌────┐ ┌─────────┐  │  └───────────┘              │
│  │ │ fix  │ │ ci │ │scaffold │  │                              │
│  │ │ (5)  │ │(4) │ │  (7)    │  │  ┌───────────┐              │
│  │ └──────┘ └────┘ └─────────┘  │  │  Memory   │              │
│  └───────────────────────────────┘  │  System   │              │
│                                      └───────────┘              │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐           │
│  │ Skills  │  │ Worktree │  │  Replay  │  │  TUI  │           │
│  └─────────┘  └──────────┘  └──────────┘  └───────┘           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│   PicoClaw (Go) — 13 tools, 19 pacotes, 97 files, <10MB RAM    │
│                                                                  │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────┐              │
│  │ 10 Channels  │─▶│ Message  │─▶│  Agent Loop  │              │
│  │(TG/Discord/  │  │   Bus    │  │  (tool loop  │              │
│  │ Slack/LINE/  │  └──────────┘  │   iterativo) │              │
│  │ QQ/DingTalk/ │       ▲        └──────┬───────┘              │
│  │ Feishu/WA/   │       │               │                      │
│  │ OneBot/      │  ┌────┴─────┐  ┌──────▼───────┐              │
│  │ MaixCAM)     │  │Subagent  │  │  Context     │              │
│  └──────────────┘  │Manager   │  │  Builder     │              │
│                    │(spawn +  │  │(SOUL/IDENTITY│              │
│  ┌──────────────┐  │subagent) │  │/USER/AGENT)  │              │
│  │  Heartbeat   │  └──────────┘  └──────┬───────┘              │
│  │  Service     │                       │                      │
│  │(HEARTBEAT.md)│  ┌──────────┐  ┌──────▼───────┐              │
│  └──────────────┘  │ Sessions │  │ 13 Tools     │              │
│                    │ Manager  │  │(file/exec/   │              │
│  ┌──────────────┐  │(JSON,    │  │ web/spawn/   │              │
│  │ 7 Providers  │  │atomic    │  │ cron/message/│              │
│  │(HTTP/Claude  │  │save)     │  │ I2C/SPI)     │              │
│  │CLI/Codex CLI/│  └──────────┘  └──────────────┘              │
│  │Copilot SDK/  │                                               │
│  │Gemini/Zhipu) │  ┌──────────┐  ┌──────────────┐              │
│  └──────────────┘  │ Skills   │  │ Cron Service│              │
│                    │ (3-tier) │  │(at/every/   │              │
│  ┌──────────────┐  └──────────┘  │cron_expr)   │              │
│  │ Memory Store │                └──────────────┘              │
│  │(MEMORY.md +  │                                               │
│  │daily notes)  │  ┌──────────────────────┐                    │
│  └──────────────┘  │ Security Sandbox     │                    │
│                    │(workspace restrict + │                    │
│                    │ command blocklist)    │                    │
│                    └──────────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Recomendação de Integração: O "Venom" do PicoClaw no NOOA

### Fase 1: Foundation (Imediato)

| # | Feature | Esforço | Impacto | Onde no NOOA |
|---|---------|---------|---------|--------------|
| 1 | **ToolResult dual-output** | Médio | 🔴 Crítico | Refatorar `CommandResult` em todos os features |
| 2 | **Dangerous command blocklist** | Baixo | 🔴 Crítico | Adicionar ao `code`, `run`, `fix` |
| 3 | **Oversized message guard** | Baixo | 🟡 Alto | Melhorar `memory` compaction |
| 4 | **Atomic saves** | Baixo | 🟡 Alto | Validar padrão no `Store.ts` |

### Fase 2: Agent Power (Próximo Sprint)

| # | Feature | Esforço | Impacto | Onde no NOOA |
|---|---------|---------|---------|--------------|
| 5 | **Subagent system** | Alto | 🔴 Crítico | Novo feature: `nooa spawn` + `nooa delegate` |
| 6 | **Heartbeat service** | Médio | 🟡 Alto | Estender `cron` com HEARTBEAT.md |
| 7 | **CLI-as-Provider** | Médio | 🟡 Alto | Novo provider: `ClaudeCodeProvider` |
| 8 | **Web Search tool** | Médio | 🟡 Alto | Novo feature: `nooa search --web` |

### Fase 3: Platform (Roadmap)

| # | Feature | Esforço | Impacto | Onde no NOOA |
|---|---------|---------|---------|--------------|
| 9 | **Multi-channel gateway** | Alto | 🟢 Médio | Telegram primeiro, depois Discord |
| 10 | **Security sandbox** | Médio | 🟢 Médio | Workspace restriction mode |

---

## 7. A Visão: O Que Nasce da Fusão

```
NOOA (38 comandos de desenvolvimento)
    +
PicoClaw (infraestrutura agentic eficiente)
    +  
Claude Code (conversational polish + tool ecosystem)
    =
────────────────────────────────────────────
O assistente de programação definitivo:
• 38+ comandos de dev (code/fix/pr/review/ci/eval/guardrail...)
• Dual-output tools (LLM vê detalhes, user vê resumo)
• Subagents pour tarefas complexas
• Heartbeat proativo
• Multi-canal (CLI + Telegram + Discord)
• Security sandbox production-ready
• CLI-as-provider (wrapa qualquer CLI como LLM)
────────────────────────────────────────────
```

---

## 8. Detalhamento Técnico das Features do PicoClaw

### 8.1 Agent Loop (`pkg/agent/loop.go` — 782 linhas)

```go
type AgentLoop struct {
    bus            *bus.MessageBus       // Pub/sub message routing
    provider       providers.LLMProvider  // Pluggable LLM backend
    workspace      string                // File-based workspace root
    maxIterations  int                   // Tool loop iteration cap (default: 20)
    sessions       *session.SessionManager
    contextBuilder *ContextBuilder
    tools          *tools.ToolRegistry
}
```

**Fluxo `runAgentLoop`:**
1. Record last channel → 2. Update tool contexts →
3. Build messages (system + history + summary + user) →
4. Save user message → 5. **LLM iteration loop** →
6. Handle empty response → 7. Save assistant message →
8. Maybe summarize → 9. Maybe send via bus

**Sumarização automática:**
- Trigger: >20 messages OU >75% context window
- Keep últimas 4 mensagens para continuidade
- Multi-part: divide no meio se >10 mensagens
- Oversized guard: skip mensagens >50% do context window
- Async via goroutine (deduplicated com `sync.Map`)

### 8.2 Tool Interface Hierarchy

```go
type Tool interface {
    Name() string
    Description() string
    Parameters() map[string]interface{}
    Execute(ctx context.Context, args map[string]interface{}) *ToolResult
}

type ContextualTool interface {
    Tool
    SetContext(channel, chatID string)
}

type AsyncTool interface {
    Tool
    SetCallback(cb AsyncCallback)
}
```

### 8.3 Provider System (7 providers)

| Provider | Tipo | Observação |
|----------|------|------------|
| `http_provider` | HTTP | OpenAI-compatible genérico |
| `claude_provider` | HTTP | Anthropic API |
| `claude_cli_provider` | **CLI** | Wrapa `claude` CLI como subprocess |
| `codex_cli_provider` | **CLI** | Wrapa `codex` CLI como subprocess |
| `codex_provider` | HTTP | OpenAI Codex |
| `github_copilot_provider` | **SDK** | Via gRPC/stdio |
| Zhipu/Gemini/Groq/DeepSeek | HTTP | Via http_provider genérico |

### 8.4 Session Manager (Atomic Saves)

```go
// Padrão crash-safe:
tmpFile := os.CreateTemp(storage, "session-*.tmp")
tmpFile.Write(data)
tmpFile.Chmod(0644)
tmpFile.Sync()   // fsync
tmpFile.Close()
os.Rename(tmpPath, sessionPath)  // atomic rename
```

### 8.5 Message Bus

```go
type MessageBus struct {
    inbound  chan InboundMessage   // Buffer: 100
    outbound chan OutboundMessage  // Buffer: 100
    handlers map[string]MessageHandler
}
```

Canais: `telegram:123456`, `discord:xyz`, `cli:direct`, `system:subagent-1`

### 8.6 Heartbeat Service

```
HEARTBEAT.md (editável pelo usuário)
    ↓
Ticker (30min, configurável)
    ↓
Build prompt com timestamp
    ↓
Resolve canal do último user ativo
    ↓
Executa: agent-processed OU spawn subagent
    ↓
Responde HEARTBEAT_OK ou envia resultado
```

### 8.7 Cron Tool (3 modos)

| Modo | Param | Exemplo |
|------|-------|---------|
| One-time | `at_seconds` | "lembrar em 10min" → 600 |
| Recurring | `every_seconds` | "a cada 2h" → 7200 |
| Cron expr | `cron_expr` | "9am daily" → `0 9 * * *` |

`deliver=true`: Notificação direta. `deliver=false`: Processado pelo agent.

### 8.8 Skills Loader (3-tier)

```
Prioridade: workspace > global > builtin
1. ~/.picoclaw/workspace/skills/{name}/SKILL.md
2. ~/.picoclaw/skills/{name}/SKILL.md
3. ./skills/{name}/SKILL.md
```

### 8.9 Security Sandbox

**Workspace restriction** (`restrict_to_workspace: true`):
- Todos os file tools restritos ao workspace
- `exec` restritos a paths no workspace
- Subagent herda restrição
- Heartbeat herda restrição

**Command blocklist** (sempre ativo):
`rm -rf`, `format`, `mkfs`, `dd if=`, `/dev/sd[a-z]`, `shutdown`, `reboot`, fork bomb

---

## 9. Métricas de Código

### NOOA
| | Contagem |
|--|---------|
| Subcomandos CLI | 38 |
| Feature directories | 37 |
| Estimated source files | 250+ |
| Test files | 50+ |
| Dependencies | 14 |

### PicoClaw
| | Contagem |
|--|---------|
| Go source files | 97 |
| Packages | 19 |
| Tools | 13 |
| Providers | 7 |
| Channels | 10 |
| Test files | ~15 |

---

## 10. Conclusão

**NOOA é um canivete suíço de desenvolvimento** — 38 comandos cobrindo todo o ciclo de vida do código (write → test → lint → review → fix → PR → merge → deploy). PicoClaw não tem nada parecido.

**PicoClaw é uma infraestrutura agentic de produção** — multi-canal, subagents, heartbeat proativo, security sandbox, CLI-as-provider. NOOA não tem nada parecido.

**A fusão dos dois cria algo único no mercado:** um assistente de programação com 40+ comandos de dev, infraestrutura agentic robusta, multi-canal, e segurança de produção.
