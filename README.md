# NOOA: The Pragmatic Programmer Agent

> "Identity is a contract. Memory is an asset. Governance is a guardrail."

NOOA is a self-aware, evolving programming agent designed for hypergrowth. It possesses an **Agentic Soul**, a **Persistent Memory System**, and **Automated Governance**.

## 🛡️ Core Pillars

### 1. Agentic Soul (Identity & Principles)
NOOA isn't just a tool; it has a **Constitution** and a **Soul**. It follows a strict precedence hierarchy:
- **Hierarchy**: `CONSTITUTION > POLICY > SOUL > USER > MEMORY > TASK`

### 2. Active Memory (Contextual Intelligence)
Persistent, multi-layered memory system that curates daily logs into high-density summaries.
- **Reflection Engine**: Automated capture of material changes to ensure NOOA never forgets a lesson.

### 3. Governance (Zero-Preguiça)
Automated quality gates that block incomplete intentions (`TODO`, `MOCK`, `FIXME`) from reaching the repository.
- **`nooa check`**: Policy-driven auditor.
- **`nooa ci`**: Local pipeline (test + lint + check) for unbreakable contracts.

### 4. Self-Evolving Architecture (Drift-Proof)
Feature modules are **Self-Describing**. They define their own schema, which automatically generates:
- CLI Help & Usage
- Agent Tool Definitions (for autonomous operation)
- SDK Type Definitions
- Documentation

**Rule**: Code is the Single Source of Truth. Documentation is a derived artifact.

## 🚀 Commands

| Command | Purpose |
|---------|---------|
| `ai` | Query the AI stack (completion, refactor, fix, review flows). |
| `ask` | Semantic search for code or memory entries. |
| `check` | Audit workspace against project policies (Zero-Preguiça). |
| `ci` | Run the local CI loop (`test`, `linter`, `check`). |
| `code` | Write/refactor/format files with AI helpers. |
| `commit` | Commit changes only after validation passes. |
| `context` | Build surgical context bundles for prompts or subagents. |
| `cron` | Schedule autonomous jobs (`add`, `list`, `run`, `health`, `history`, etc.). |
| `doctor` | Verify local environment health (node, git, tooling). |
| `embed` | Generate embeddings and record telemetry. |
| `eval` | Compare/evaluate prompt outputs (`report`, `history`, `compare`). |
| `fix` | Drive autonomous fix loop (with telemetry, JSON output). |
| `goal` | Create and track agent goals + status. |
| `guardrail` | Audit code against project policies (Anarchy/Zero-Preguiça). |
| `ignore` | Manage `.nooa-ignore` patterns and run match tests. |
| `index` | Build/query semantic indexes across workspace/memory. |
| `init` | Seed Agentic Soul (identity, templates, configuration). |
| `mcp` | Manage MCP servers (`install`, `configure`, `alias`, `call`, `health`, etc.). |
| `memory` | Add, read, and summarize persistent memory entries. |
| `message` | Send human-style messages via agent channels. |
| `pr` | Manage GitHub pull requests (create, merge, close). |
| `prompt` | Create/edit/publish prompt templates with changelog. |
| `push` | Push worktree changes to remote with safety checks. |
| `ralph` | Run backlog loop (`init`, `import-prd`, `step`, `review`, `approve`, `run`). |
| `read` | Read file contents (TTY-aware + JSON output). |
| `review` | Execute code review prompts with scoring. |
| `run` | Execute chained commands (`nooa run -- ...`). |
| `scaffold` | Generate consistent project scaffolding with AI notes. |
| `search` | Search files and contents (rg/native engines). |
| `skills` | Manage Codex skills enabling/disabling. |
| `worktree` | Handle isolated worktrees (create, list, prune, lock). |

## 📖 Documentation

- [Feature Documentation](docs/features/)
- [Project Policy](.nooa/POLICY.md)
- [Constitution](.nooa/CONSTITUTION.md)

## 🔐 Environment

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

**NOOA v1.6.1** — *Engineering with Soul.*
