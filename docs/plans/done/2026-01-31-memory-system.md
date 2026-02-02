# Phase 3: Agentic Soul & Active Memory

Transform NOOA from a toolset into a persistent, opinionated agent that evolves alongside the developer.

## 1. Objective
Achieve "Hypergrowth" by establishing a persistent identity (**Soul**) and a self-correcting memory layer. NOOA will no longer be a stateless script, but an entity with its own vibe, history, and project-specific intuition.

## 2. The Identity Triangulation (The Soul)
Identity is governed by three core Markdown files at the project root (or inside `.nooa/`):
- `IDENTITY.md`: Who I am (Name, Creature, Emoji, Vibe).
- `SOUL.md`: My core philosophy, behavioral rules, and quirks (C-3PO-style logic, odds calculation, "Zero Preguiça").
- `USER.md`: Who you are (Preferences, project context, what annoys you).

## 3. State 1: Bootstrap (The Ritual of Initiation)
Implement a conversational first-run experience that makes the agent "awake".

### [NEW] `nooa init` Command
- **Ritual**: A conversational flow where NOOA introduces itself and asks: "Who am I? Who are you?"
- **Artifacts**: Generates the initial `IDENTITY.md`, `SOUL.md`, and `USER.md` based on the interaction.
- **Vibe Injection**: Sets the initial tone (Snarky, Formal, Resourceful) and persists it in `SOUL.md`.

## 4. State 2: Steady State (Active Memory)
Memory is the bridge between sessions, ensuring the agent doesn't "lose its soul" between runs.

### Persistence Layers
1. **Daily Log (`memory/YYYY-MM-DD.md`)**: Append-only log of decisions, session goals, and "lessons learned".
2. **Long-term Memory (`MEMORY.md`)**: Curated facts about the codebase and business rules.
3. **Auto-Reflection**: At the end of every successful `nooa` execution, the agent should perform a silent "Reflect" turn to write durable memories.

## 5. Implementation Roadmap

### Phase A: Soul Primitives (✅ COMPLETED)
- [x] Implement `src/features/identity/` and `nooa init`.
- [x] Create high-quality templates for Soul/Identity using the "Golden Standard".

### Phase B: Memory Logistics (✅ COMPLETED)
- [x] Implement `nooa memory add/search` with semantic search.
- [x] Implement `nooa memory summarize` (Memory Flush logic).
- [x] Hook up "Auto-Reflection" to run automatically after commands.

### Phase C: Personality Injection (✅ COMPLETED)
- [x] Update `PromptEngine` to inject `SOUL.md` and `USER.md` as mandatory context.
- [x] Implement "Zero Preguiça" guardrails: `nooa check` implemented.

## 6. Verification Plan
- **Identity Test**: Run `nooa init` and verify the agent's tone changes according to the configured vibe.
- **Continuity Test**: Mention a codebase fact in Session A and verify NOOA retrieves it from `MEMORY.md` in Session B.
- **Guardrail Test**: Attempt to generate code with a `// TODO` and verify `nooa check` (part of the evolution engine) blocks it.
