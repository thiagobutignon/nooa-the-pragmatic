# NOOA: Agent-First Engineering System

> "Identity is a contract. Memory is an asset. Investigation is a capability."

NOOA is no longer just a programming agent shell. It is an **agent-first engineering system** for building, debugging, verifying, replaying, and evolving software with explicit runtime evidence.

The project is now organized around a practical loop:

`reproduce -> inspect -> fix -> verify -> replay -> learn`

That loop is exposed through commands, persisted through artifacts, and reusable by other agents.

## Core Pillars

### 1. Agentic Soul (Identity & Principles)
NOOA isn't just a tool; it has a **Constitution** and a **Soul**. It follows a strict precedence hierarchy:
- **Hierarchy**: `CONSTITUTION > POLICY > SOUL > USER > MEMORY > TASK`

### 2. Active Memory (Contextual Intelligence)
Persistent, multi-layered memory system that curates daily logs into high-density summaries.
- **Reflection Engine**: Automated capture of material changes to ensure NOOA never forgets a lesson.

### 3. Governance (Zero-Preguica)
Automated quality gates that block incomplete intentions (`TODO`, `MOCK`, `FIXME`) from reaching the repository.
- **`nooa check`**: Policy-driven auditor.
- **`nooa ci`**: Local pipeline (test + lint + check) for unbreakable contracts.

### 4. Agent-First Investigation
NOOA now has native investigation primitives designed for coding agents, not only humans.

- **`nooa debug inspect-at`**: run to a file/line and capture a snapshot
- **`nooa debug inspect-on-failure`**: capture stack/source/state on runtime failure
- **`nooa debug inspect-test-failure`**: convert test failures into structured evidence
- **`nooa debug capture`**: grab one-shot startup/runtime evidence
- **`nooa profile inspect`**: capture CPU hotspot summaries as reusable investigation artifacts

These commands are atomic by design: launch, capture evidence, and stop. That makes them much easier for agents to use reliably than long-lived interactive sessions.

### 5. Replayable Engineering State
NOOA does not treat debugging as disposable terminal output anymore.

- **`nooa replay`** records investigation state as nodes and edges
- Ralph progress writes structured investigation artifacts into replay
- retries, fixes, and impacts are explicit in the graph

This makes failures and recoveries navigable for future agents instead of buried in prose.

### 6. Self-Evolving Architecture (Drift-Proof)
Feature modules are **Self-Describing**. They define their own schema, which automatically generates:
- CLI Help & Usage
- Agent Tool Definitions (for autonomous operation)
- SDK Type Definitions
- Documentation

**Rule**: Code is the Single Source of Truth. Documentation is a derived artifact.

## Development Order

NOOA should evolve in this order:

`CLI First -> Agent First -> TDD First -> Debug First -> Profile First -> Dogfooding First -> API/MCP -> Desktop -> UI/TUI`

The command surface is the primary product contract. Runtime investigation should be possible from commands before behavior is hidden behind adapters or visual layers.

## What Changed

Recent work materially repositioned the project:

- `nooa debug` became an **agent-first investigation surface**
- `nooa profile` became part of the same evidence model
- `ralph` now consumes investigation artifacts instead of relying only on notes
- `replay` now shows failed attempts, retries, fixes, impacts, and profile/test evidence
- local skills and workflow docs now bias toward atomic evidence capture over guesswork

In practice, this means new agents entering the repo can inherit working investigation capabilities instead of rediscovering them manually.

## Command Surface

| Command | Purpose |
|---------|---------|
| `act` | Run the autonomous agent orchestrator over configured gates and workflows. |
| `agent` | Run an interactive agentic loop for a prompt. |
| `ai` | Query the AI stack (completion, refactor, fix, review flows). |
| `ask` | Semantic search for code or memory entries. |
| `backlog` | Generate and operate backlog PRDs and kanban state. |
| `check` | Audit workspace against project policies (Zero-Preguiça). |
| `ci` | Run the local CI loop (`test`, `linter`, `check`). |
| `code` | Write/refactor/format files with AI helpers. |
| `commit` | Commit changes only after validation passes. |
| `context` | Build surgical context bundles for prompts or subagents. |
| `cron` | Schedule autonomous jobs (`add`, `list`, `run`, `health`, `history`, etc.). |
| `debug` | Agent-first runtime debugging with atomic evidence capture. |
| `doctor` | Verify local environment health (node, git, tooling). |
| `embed` | Generate embeddings and record telemetry. |
| `eval` | Compare/evaluate prompt outputs (`report`, `history`, `compare`). |
| `fix` | Drive autonomous fix loop (with telemetry, JSON output). |
| `gate` | Verify project state against defined quality gates. |
| `gateway` | Run the gateway channel orchestrator. |
| `goal` | Create and track agent goals + status. |
| `guardrail` | Audit code against project policies (Anarchy/Zero-Preguiça). |
| `ignore` | Manage `.nooa-ignore` patterns and run match tests. |
| `index` | Build/query semantic indexes across workspace/memory. |
| `init` | Seed Agentic Soul (identity, templates, configuration). |
| `mcp` | Manage MCP servers (`install`, `configure`, `alias`, `call`, `health`, etc.). |
| `memory` | Add, read, and summarize persistent memory entries. |
| `message` | Send human-style messages via agent channels. |
| `papers` | Fetch the latest AI research papers from arXiv. |
| `pr` | Manage GitHub pull requests (create, merge, close). |
| `profile` | Capture agent-first CPU hotspot summaries for commands. |
| `prompt` | Create/edit/publish prompt templates with changelog. |
| `push` | Push worktree changes to remote with safety checks. |
| `ralph` | Run backlog loop (`init`, `import-prd`, `step`, `review`, `approve`, `run`). |
| `read` | Read file contents (TTY-aware + JSON output). |
| `review` | Execute code review prompts with scoring. |
| `run` | Execute chained commands (`nooa run -- ...`). |
| `scaffold` | Generate consistent project scaffolding with AI notes. |
| `search` | Search files and contents (rg/native engines). |
| `skills` | Manage Codex skills enabling/disabling. |
| `tui` | Launch terminal user interfaces. |
| `workflow` | Run a verification workflow sequence. |
| `worktree` | Handle isolated worktrees (create, list, prune, lock). |

## Recommended Flows

### Investigate a failing test

```bash
nooa debug inspect-test-failure --json -- bun test path/to/test.ts
```

### Capture runtime state at a known location

```bash
nooa debug inspect-at src/app.ts:42 --json -- node src/app.ts
```

### Capture CPU hotspots

```bash
nooa profile inspect --json -- node scripts/profile-target.js
```

### Inspect investigation history

```bash
nooa replay show <node-id>
```

### Let Ralph reuse investigation artifacts

- failed tests can attach structured debug evidence
- performance stories can attach profile evidence
- replay keeps retries, fixes, and impacts connected

## Documentation

- [Feature Documentation](docs/features/)
- [Project Policy](.nooa/POLICY.md)
- [Constitution](.nooa/CONSTITUTION.md)
- [AI-Assisted Development Workflow](docs/reference/ai-assisted-development-workflow.md)

## Environment

Some commands require GitHub access (e.g. `nooa pr`). Authenticate via GitHub CLI:

```bash
gh auth login
```

### Ralph Dogfooding (Complex Story Budget)

Use higher worker turns/time for complex story execution:

```bash
NOOA_AI_PROVIDER=ollama \
NOOA_AI_MODEL=gpt-oss:20b \
NOOA_REVIEW_AI_PROVIDER=ollama \
NOOA_REVIEW_AI_MODEL=llama3.1:8b \
NOOA_WORKER_TIMEOUT_MS=420000 \
NOOA_REVIEWER_TIMEOUT_MS=240000 \
NOOA_WORKER_TURNS=20 \
bun run index.ts ralph step --json
```

---

**NOOA v1.6.1** — *Engineering with Soul, Evidence, and Replay.*
