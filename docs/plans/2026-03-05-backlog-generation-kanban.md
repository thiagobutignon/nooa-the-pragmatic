# Backlog Generation + Kanban Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar um fluxo completo para converter uma história macro em PRD estruturado (user stories + acceptance criteria), expor isso via CLI/API e operar um board Kanban estilo Trello integrado ao Ralph.

**Architecture:** Vamos implementar primeiro a feature `backlog` no padrão self-evolving module (CommandBuilder), com serviços puros reutilizáveis para geração/split/movimentação de cards. A API HTTP reaproveita os mesmos serviços da CLI. O frontend Kanban consumirá essa API e refletirá estados Ralph (`pending/implementing/verifying/peer_review_*/passed/blocked`) em colunas operacionais.

**Tech Stack:** Bun + TypeScript, CommandBuilder NOOA, testes com Bun test, endpoint HTTP interno do projeto (feature API), frontend estático HTML/CSS/JS.

---

### Task 1: Scaffold da feature `backlog` (CLI contract + docs geradas)

**Files:**
- Create: `src/features/backlog/cli.ts`
- Create: `src/features/backlog/cli.test.ts`
- Create: `src/features/backlog/types.ts`
- Modify: `index.ts` (registrar comando + agent docs no registry)
- Create/Modify: `docs/features/backlog.md` (gerado via self-evolving module)

**Step 1: Write the failing test**
- Criar teste em `src/features/backlog/cli.test.ts` para `nooa backlog --help`.
- Esperado: help mostra `generate`, `split`, `board`, `move`.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/cli.test.ts`
- Expected: FAIL por comando não registrado.

**Step 3: Write minimal implementation**
- Implementar `cli.ts` com `CommandBuilder` no padrão do repo.
- Subcomandos válidos: `generate | split | board | move`.
- Registrar em `index.ts`.
- Exportar obrigatoriamente:
  - `backlogAgentDoc = backlogBuilder.buildAgentDoc(false)`
  - `backlogFeatureDoc = (includeChangelog) => backlogBuilder.buildFeatureDoc(includeChangelog)`
- Configurar `.telemetry(...)` no builder (`eventPrefix: "backlog"` + metadados básicos de sucesso/falha).

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/cli.test.ts`
- Expected: PASS.
- Dogfooding imediato:
  - `bun run index.ts backlog --help`
  - `bun run index.ts backlog generate --help`

**Step 5: Commit**
- `git add src/features/backlog/cli.ts src/features/backlog/cli.test.ts src/features/backlog/types.ts index.ts`
- `git commit -m "feat(backlog): scaffold backlog command contract"`

---

### Task 2: `backlog generate` (história macro -> PRD JSON Ralph-compatible)

**Files:**
- Create: `src/features/backlog/generate.ts`
- Create: `src/features/backlog/generate.test.ts`
- Modify: `src/features/backlog/cli.ts`
- Modify: `src/features/backlog/types.ts`

**Step 1: Write the failing test**
- Testar geração mínima:
  - input: prompt textual único
  - output: objeto com `project`, `branchName`, `description`, `userStories[]`
  - cada story com `id`, `title`, `description`, `acceptanceCriteria[]`, `priority`, `passes=false`, `state="pending"`.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/generate.test.ts`
- Expected: FAIL.

**Step 3: Write minimal implementation**
- Serviço puro `generateBacklogFromPrompt(...)`.
- No MVP, usar heurística determinística + chamada opcional a AI provider (se presente).
- Garantir saída válida para `nooa ralph import-prd`.
- Expor no CLI:  
  - `nooa backlog generate "<texto>" --out docs/plans/.../prd.json --json`.
- Incluir validação de schema no fluxo de saída (falha explícita em payload inválido).

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/generate.test.ts`
- Expected: PASS.
- Dogfooding imediato:
  - `bun run index.ts backlog generate "Criar landing do Ralph Loop" --json`
  - `bun run index.ts backlog generate "Criar landing do Ralph Loop" --out docs/plans/dogfooding/tmp-prd.json`

**Step 5: Commit**
- `git add src/features/backlog/generate.ts src/features/backlog/generate.test.ts src/features/backlog/cli.ts src/features/backlog/types.ts`
- `git commit -m "feat(backlog): add generate subcommand for ralph-compatible prd"`

---

### Task 2.5: `backlog validate` (schema guard explícito)

**Files:**
- Create: `src/features/backlog/validate.ts`
- Create: `src/features/backlog/validate.test.ts`
- Modify: `src/features/backlog/cli.ts`
- Modify: `src/features/backlog/types.ts`

**Step 1: Write the failing test**
- PRD válido retorna `ok: true`.
- PRD inválido (sem `userStories[].acceptanceCriteria`) retorna erro detalhado.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/validate.test.ts`

**Step 3: Write minimal implementation**
- Implementar `validateBacklogPrd(prd)` com erros determinísticos.
- CLI: `nooa backlog validate --in prd.json --json`.

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/validate.test.ts`
- Dogfooding imediato:
  - `bun run index.ts backlog validate --in docs/plans/dogfooding/tmp-prd.json --json`

**Step 5: Commit**
- `git add src/features/backlog/validate.ts src/features/backlog/validate.test.ts src/features/backlog/cli.ts src/features/backlog/types.ts`
- `git commit -m "feat(backlog): add validate subcommand for prd schema guard"`

---

### Task 3: `backlog split` (refinar e quebrar histórias grandes)

**Files:**
- Create: `src/features/backlog/split.ts`
- Create: `src/features/backlog/split.test.ts`
- Modify: `src/features/backlog/cli.ts`

**Step 1: Write the failing test**
- Cenário: PRD com stories longas -> `split --max-stories 8 --max-ac 5`.
- Esperado: stories quebradas por prioridade, IDs estáveis (`US-001...`), limite respeitado.
- Edge cases obrigatórios:
  - PRD já com mais de `max-stories` (definir e testar: rejeitar com erro explícito).
  - Story com mais de `max-ac` (definir e testar: dividir em novas stories, sem truncar AC silenciosamente).

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/split.test.ts`

**Step 3: Write minimal implementation**
- Implementar `splitBacklogStories(prd, options)`.
- CLI: `nooa backlog split --in prd.json --out prd.split.json`.

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/split.test.ts`
- Dogfooding imediato:
  - `bun run index.ts backlog split --in docs/plans/dogfooding/tmp-prd.json --out docs/plans/dogfooding/tmp-prd.split.json --json`

**Step 5: Commit**
- `git add src/features/backlog/split.ts src/features/backlog/split.test.ts src/features/backlog/cli.ts`
- `git commit -m "feat(backlog): add split subcommand for story decomposition"`

---

### Task 4: `backlog board` + `backlog move` (Kanban state engine)

**Files:**
- Create: `src/features/backlog/board.ts`
- Create: `src/features/backlog/board.test.ts`
- Modify: `src/features/backlog/cli.ts`

**Step 1: Write the failing test**
- Testar mapeamento de estados para colunas:
  - `Todo` => `pending`
  - `In Progress` => `implementing|verifying`
  - `In Review` => `peer_review_*`
  - `Done` => `passed`
- Testar `move` com transições válidas e inválidas.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/board.test.ts`

**Step 3: Write minimal implementation**
- `renderBacklogBoard(prd)` (json + texto).
- `moveBacklogStory(prd, storyId, targetColumn)` com validação de transição.
- CLI:
  - `nooa backlog board --in .nooa/ralph/prd.json --json`
  - `nooa backlog move --in ... --story US-002 --to review --out ...`

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/board.test.ts`
- Dogfooding imediato:
  - `bun run index.ts backlog board --in docs/plans/dogfooding/tmp-prd.split.json --json`
  - `bun run index.ts backlog move --in docs/plans/dogfooding/tmp-prd.split.json --story US-001 --to review --out docs/plans/dogfooding/tmp-prd.split.json --json`

**Step 5: Commit**
- `git add src/features/backlog/board.ts src/features/backlog/board.test.ts src/features/backlog/cli.ts`
- `git commit -m "feat(backlog): add board and move kanban operations"`

---

### Task 5: Integração CLI com Ralph (bridge operacional)

**Files:**
- Create: `src/features/backlog/ralph-bridge.ts`
- Create: `src/features/backlog/ralph-bridge.test.ts`
- Modify: `src/features/backlog/cli.ts`

**Step 1: Write the failing test**
- Cenário:
  - `backlog generate` cria PRD
  - `backlog board` exibe
  - `ralph import-prd` aceita sem ajustes
- Validar estrutura e campos obrigatórios.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/ralph-bridge.test.ts`

**Step 3: Write minimal implementation**
- Helper de compatibilidade Ralph.
- Comando opcional: `nooa backlog import-ralph --in prd.json` (wrapper de import).
- Implementar sincronização bidirecional mínima:
  - `syncFromRalph(prdPath, ralphPrdPath)` para refletir estados do Ralph no board.
  - `syncToRalph(prdPath, ralphPrdPath)` para movimentos válidos iniciados no board.

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/ralph-bridge.test.ts`
- Dogfooding imediato:
  - `bun run index.ts ralph import-prd docs/plans/dogfooding/tmp-prd.split.json`
  - `bun run index.ts backlog board --in .nooa/ralph/prd.json --json`

**Step 5: Commit**
- `git add src/features/backlog/ralph-bridge.ts src/features/backlog/ralph-bridge.test.ts src/features/backlog/cli.ts`
- `git commit -m "feat(backlog): bridge backlog outputs with ralph import flow"`

---

### Task 6: API layer (CLI-first services reutilizados)

**Files:**
- Create: `src/features/backlog/api.ts`
- Create: `src/features/backlog/api.test.ts`
- Modify: roteador/registry HTTP atual do projeto (arquivo onde comandos web são registrados)

**Step 1: Write the failing test**
- Endpoints:
  - `POST /backlog/generate`
  - `POST /backlog/split`
  - `GET /backlog/board?path=...`
  - `POST /backlog/move`
- Esperado: retornos JSON e erros de validação 4xx.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/api.test.ts`

**Step 3: Write minimal implementation**
- API chama os mesmos serviços de `generate/split/board/move`.
- Sem lógica duplicada.

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/api.test.ts`
- Dogfooding imediato:
  - chamar endpoint `/backlog/generate` e validar payload resultante com `/backlog/validate`.

**Step 5: Commit**
- `git add src/features/backlog/api.ts src/features/backlog/api.test.ts <router-file>`
- `git commit -m "feat(backlog): expose backlog generation and board via api"`

---

### Task 7: Frontend Kanban (Trello-like) para operação com IA

**Files:**
- Create: `src/features/backlog/ui/index.html`
- Create: `src/features/backlog/ui/styles.css`
- Create: `src/features/backlog/ui/script.js`
- Create: `src/features/backlog/ui/ui.test.ts` (testes mínimos de comportamento JS utilitário)

**Step 1: Write the failing test**
- Testar funções JS puras:
  - mapear payload API -> colunas
  - mover card no estado local
  - gerar payload de mensagem para AI (`generate`).
- Adicionar teste de integração UI/API:
  - fluxo `generate -> preencher board -> move -> refresh` com mock HTTP.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog/ui/ui.test.ts`

**Step 3: Write minimal implementation**
- Layout Kanban com colunas `Todo`, `Em Execução`, `Em Revisão`, `Concluído`.
- Painel “Mensagem para AI”:
  - envia prompt macro
  - recebe PRD e preenche board
  - botão para gerar acceptance criteria + plano.
- UI consome API da Task 6.

**Step 4: Run test to verify it passes**
- Run: `bun test src/features/backlog/ui/ui.test.ts`
- Manual: abrir `index.html` e validar drag/move + geração.

**Step 5: Commit**
- `git add src/features/backlog/ui/index.html src/features/backlog/ui/styles.css src/features/backlog/ui/script.js src/features/backlog/ui/ui.test.ts`
- `git commit -m "feat(backlog-ui): add trello-style kanban for ai backlog operations"`

---

### Task 8: E2E dogfooding do fluxo completo

**Files:**
- Create: `docs/plans/dogfooding/backlog-kanban-dogfooding.md`
- Modify: `docs/features/ralph.md` (seção integração com backlog)
- Modify: `docs/features/<novo-backlog-doc>.md` (gerado pelo self-evolving module)

**Step 1: Write the failing test**
- Script de validação E2E:
  - `backlog generate` -> PRD
  - `ralph import-prd`
  - `ralph step`
  - `backlog board` reflete novo estado.

**Step 2: Run test to verify it fails**
- Run: `bun test src/features/backlog --bail`

**Step 3: Write minimal implementation**
- Ajustes finais de integração e docs.

**Step 4: Run test to verify it passes**
- Run:
  - `bun test src/features/backlog`
  - `bun test src/features/ralph`
  - validação manual do board UI.

**Step 5: Commit**
- `git add docs/plans/dogfooding/backlog-kanban-dogfooding.md docs/features/ralph.md docs/features/backlog.md`
- `git commit -m "docs(backlog): add e2e dogfooding and integration guide"`

---

### Task 9: Quality gates e PR final

**Files:**
- Modify: PR body/checklist

**Step 1: Run complete verification**
- `bun test src/features/backlog`
- `bun test src/features/ralph`
- `bun test` (se viável no tempo)
- `bunx biome check src/features/backlog src/features/ralph`

**Step 2: Verify generated docs/help**
- `bun run index.ts backlog --help`
- `bun run index.ts backlog generate --help`
- `bun run index.ts backlog split --help`
- `bun run index.ts backlog board --help`
- `bun run index.ts backlog move --help`
- `bun run index.ts backlog validate --help`
- Conferir doc de feature gerado.
- Conferir exports `backlogAgentDoc/backlogFeatureDoc` e registro no registry de tools.

**Step 3: Commit + push + PR**
- `git push -u origin feature/ralph-loop`
- Atualizar PR existente com seção “Backlog generation + Kanban”.

---

## Notas de escopo (YAGNI)
- Não implementar autenticação no MVP da API/UI.
- Não implementar colaboração multiusuário em tempo real no MVP.
- Não implementar drag-and-drop com biblioteca externa; usar controles simples primeiro.

## Riscos e mitigação
- **LLM output inconsistente:** validar sempre via `backlog validate` antes de `ralph import-prd`.
- **Stories super amplas:** `split` obrigatório com limites.
- **Drift CLI/API:** API reaproveita serviços puros da CLI (fonte única).

## Definition of Done
- `nooa backlog generate` produz PRD importável no Ralph.
- Board CLI e UI representam corretamente estado do fluxo.
- API funcional para geração/split/move/board.
- Dogfooding documentado com evidência de execução real.
