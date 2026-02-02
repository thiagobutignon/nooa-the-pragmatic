# Memory Management Implementation Plan

## Goal
Implement missing subcommands for `nooa memory` to provide full CRUD and lifecycle management for the agent's memory.

## User Review Required
- **Subcommand behavior**:
    - `delete <id>`: Removes a memory entry by ID.
    - `update <id> <content>`: Updates the content of a memory entry.
    - `export <path>`: Exports the memory database (or specific entries) to a JSON file.
    - `import <path>`: Imports memory entries from a JSON file.
    - `clear`: [DANGER] Wipes all memory entries (requires confirmation).
    - `search`: Verify semantic search works.
    - `promote`: (Clarification needed) What does promote do? Likely moves from short-term to long-term or increases importance?
    - `get <id>`: Retrieve specific memory by ID.
    - `summarize`: Trigger summarization.

## Proposed Changes

### `src/features/memory`

#### [MODIFY] [cli.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/memory-management/src/features/memory/cli.ts)
- Register new subcommands: `delete`, `update`, `export`, `import`, `clear`.

#### [MODIFY] [engine.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/memory-management/src/features/memory/engine.ts)
- Add methods to `MemoryEngine`:
    - `deleteEntry(id: string)`
    - `updateEntry(id: string, content: string)`
    - `clearAll()`
    - `exportData()`
    - `importData(data: any[])`

### `docs/commands`

#### [MODIFY] [memory.md](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/memory-management/docs/commands/memory.md)
- Document all subcommands.
