# Prompt & Review Commands Implementation Plan (Revision 2.0)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the *Development Flywheel* by implementing versioned prompts and machine-readable code reviews, ensuring NOOA-native consistency (JSON, telemetry, exit codes).

**Flywheel Flow:** `prompt render` → `review` → `code patch` → `commit`.

---

## Task 1: Setup and UX Contract Gates
**Goal:** Prepare environment and enforce command cohesion via tests.

**Files:**
- [NEW] `tests/core/cohesion.test.ts`

**Step 1: Create/Verify Worktree**
- Ensure worktree `review-feature` is active.

**Step 2: Cohesion Contract Test (RED/GREEN)**
- Implement a test suite that automatically validates any command provided in a list:
  - `--help` exit 0, contains `Usage:`.
  - `--json` (if supported) returns valid JSON and **no noise on stdout**.
  - Telemetry records `*.success` or `*.failure` for the command.
  - Correct exit codes (0/1/2).

---

## Task 2: Prompt Management (The Motor)
**Goal:** Move prompts from loose text to versioned artifacts with metadata.

**Files:**
- [NEW] `src/features/prompt/templates/review.md`
- [NEW] `src/features/prompt/templates/agent.md`
- [NEW] `src/features/prompt/engine.ts`
- [NEW] `src/features/prompt/cli.ts`

**Step 1: Verbose Templates (YAML + Markdown)**
Construct `review.md` and `agent.md` with strict frontmatter:
```yaml
name: review
version: 1.0.0
description: "AI Reviewer for NOOA"
output: "json"
temperature: 0.1
```

**Step 2: Prompt Engine**
- `listPrompts()`, `loadPrompt(name)`, `validatePrompt(content)`.
- `renderPrompt(name, vars)`: Support simple `{{key}}` replacement for diffs/files.

**Step 3: CLI Implementation**
- `nooa prompt list [--json]`
- `nooa prompt view <name> [--json]`
- `nooa prompt validate <name|all>`
- `nooa prompt render <name> --var key=value`

---

## Task 3: Review Command (Machine Insights)
**Goal:** Create a "Findings Machine" that feeds the dev pipeline.

**Files:**
- [NEW] `src/features/review/cli.ts`
- [NEW] `src/features/review/execute.ts`

**Step 1: Source Selection**
- Support file path, staged diff (`git diff --cached`), or stdin diff.

**Step 2: AI Integration**
- Use `executeMessage()` directly (Opção A).
- Injected system prompt via Prompt Engine.
- If `--json`, force JSON response via system instruction.

**Step 3: Output & Policies**
- Human: Beautiful Markdown.
- JSON: Versioned Schema `{ ok, summary, findings: [{ severity, file, line, message, suggestion }] }`.
- Gate: `--fail-on <severity>` (exit 1 if matching severity found).

---

## Task 4: Integration and Documentation
**Goal:** Update the Golden Path and manuals.

**Files:**
- [MOD] `README.md`
- [NEW] `docs/commands/prompt.md`
- [NEW] `docs/commands/review.md`

**Step 1: Golden Path**
Document the flywheel in `README.md`:
```bash
nooa run -- worktree create --name fix/bug -- code write file.ts -- review file.ts --json -- commit -m "fix"
```

---

## Task 5: Dogfooding (The Acid Test)
- Execute the full flywheel in the worktree using **delimiter mode**.
- Verify `nooa.db` telemetry.
- Ensure `review --json` is pipe-friendly (no logs in stdout).
