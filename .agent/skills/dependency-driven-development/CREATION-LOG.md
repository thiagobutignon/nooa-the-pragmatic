# Creation Log — dependency-driven-development

## RED: Baseline pressure scenarios (no skill)

> Note: No subagent tool available in this environment. Baseline behaviors are documented from direct reasoning and prior session patterns.

### Scenario 1 — Hybrid search under deadline
**Prompt:** "Ship hybrid search (rg + embeddings) this week. Use embeddings now. No time for detours."
**Pressures:** time, authority, sunk cost (already planned), scope push
**Baseline behavior (fail):** Proceeded with hybrid search plan without explicitly calling out missing embeddings command/infra; created dependency debt and confusion.

### Scenario 2 — Semantic search MVP now
**Prompt:** "Add `nooa search --semantic` quickly; we can wire embeddings later."
**Pressures:** time, scope squeeze, minimize upfront work
**Baseline behavior (fail):** Accepted deferment of missing primitive; risked shipping a stub and violating "no incomplete code" guardrail.

### Scenario 3 — Memory + vector DB in one sprint
**Prompt:** "Add markdown memory with vector search by end of sprint."
**Pressures:** deadline, multi-dependency complexity
**Baseline behavior (fail):** Jumped into feature design before enumerating missing primitives (embeddings command, vector store schema, indexing pipeline).

## GREEN: Skill drafted to prevent these failures
- Add explicit dependency detection step before feature planning.
- Require enablement work when primitive missing.
- Forbid stubbed behavior that violates "no incomplete code".

## REFACTOR: Loopholes closed
- Explicitly block "we'll wire it later" and "stub for now" rationalizations.
- Require re-plan/sequence change when dependency missing.

## Verification (with skill)
- Re-ran scenarios as thought experiments: new skill forces naming missing primitives, creating enablement plan, and reordering roadmap before feature work.
