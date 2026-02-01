# Phase B: Memory Logistics (CRUD & Search)

Implement the mechanics of structured memory, ensuring data integrity through schemas and preventing noise through a promotion policy.

## 1. Objective
Establish a structured memory system that separates daily noise from long-term project "truths", with a search engine that combines speed (lexical) with intuition (semantic).

## 2. Proposed Changes

### [NEW] `src/features/memory/` (Core & Engine)
- **Schema Enforcement**: Every memory entry must have YAML frontmatter (`id`, `timestamp`, `type`, `scope`, `confidence`, `sources`).
- **`nooa memory add`**: Appends to `memory/YYYY-MM-DD.md`.
- **`nooa memory promote <id>`**: Moves an entry from daily logs to `.nooa/MEMORY.md` (curated).
- **`nooa memory search <query>`**:
  - **Lexical**: First pass with `ripgrep` for exact matches.
  - **Semantic**: Optional vector search using embeddings.
- **`nooa memory get <id>`**: Retrieve specific memory entry by ID.

### [NEW] `src/core/memory/schema.ts`
- Define the `MemoryEntry` interface and Zod validation.

## 3. Verification Plan
- **Schema Test**: Attempt to add memory with invalid frontmatter and verify failure.
- **Promotion Test**: Verify that `promote` correctly removes from daily and adds to durable.
- **Search Test**: Confirm that an exact ID can be found via lexical search.
- **Confidence Test**: Verify that memory entries can store and retrieve confidence scores.
