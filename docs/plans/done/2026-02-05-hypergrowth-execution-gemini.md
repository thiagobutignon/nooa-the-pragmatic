# Hypergrowth Execution Plan (Gemini)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Executar os reparos fundacionais em paralelo ao Codex, com foco em documentação, contratos e testes de integração que validem o pipeline.

**Architecture:** Gemini foca em documentação e testes que não conflitam com o core plumbing. Codex foca em implementação de EventBus/WorktreePool/WorkflowEngine.

**Tech Stack:** Bun, TypeScript, Ink.js, SQLite telemetry, Git worktrees.

---

### Task 1: Documentar contratos oficiais

**Files:**
- Create: `docs/architecture/EVENT_SCHEMA.md`
- Create: `docs/architecture/WORKFLOW_ENGINE.md`

**Step 1: Write the docs**

Descrever de forma objetiva:
- Event Schema exaustivo
- WorkflowContext + Gate + Step
- GateResult + exemplos
- Sequência do loop disciplinado

**Step 2: Commit**

```bash
git add docs/architecture/EVENT_SCHEMA.md docs/architecture/WORKFLOW_ENGINE.md
git commit -m "docs: add event schema and workflow engine specs"
```

---

### Task 2: Testes de integração para eventos

**Files:**
- Create/Modify: `tests/integration/events.act.test.ts`
- Create/Modify: `tests/integration/events.worktree.test.ts`

**Step 1: Write failing tests**

Cada teste deve verificar que eventos padronizados são emitidos ao executar o comando:

```ts
const result = await runCli("nooa act \"goal\" --json");
expect(events).toContainEqual({ type: "act.started" });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/integration/events.*.test.ts`  
Expected: FAIL (eventos ausentes)

**Step 3: Commit**

```bash
git add tests/integration/events.act.test.ts tests/integration/events.worktree.test.ts
git commit -m "test: add integration tests for event emissions"
```

---

### Task 3: Checklist de validação por phase

**Files:**
- Create: `docs/plans/hypergrowth-phase-checklist.md`

**Step 1: Write checklist**

Inserir:
- DoD por phase
- Métricas de sucesso
- Gate de CLI redonda

**Step 2: Commit**

```bash
git add docs/plans/hypergrowth-phase-checklist.md
git commit -m "docs: add hypergrowth phase checklist"
```

---

### Task 4: TUI State Machine Spec

**Files:**
- Create: `docs/architecture/TUI_STATE_MACHINE.md`

**Step 1: Write spec**

Definir:
- estados (`idle`, `running`, `paused`, `error`)
- transições
- eventos que atualizam o UI

**Step 2: Commit**

```bash
git add docs/architecture/TUI_STATE_MACHINE.md
git commit -m "docs: add tui state machine spec"
```

---

**Plan complete.**
