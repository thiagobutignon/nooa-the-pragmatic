# Features Index Improvements & Unit Tests

Implement missing subcommands for the `index` feature: `file`, `clear`, `stats`, and `rebuild`. Ensure all changes are covered by unit tests using TDD.

## User Review Required

> [!NOTE]
> This plan involves modifying the core `Store` class to support clearing and counting embeddings.

## Proposed Changes

### Core Database
#### [MODIFY] [src/core/db/index.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/improve-index-commands/src/core/db/index.ts)
- Add `clear()` method to remove all records from `embeddings` table.
- Add `stats()` method to return count of documents/embeddings.

### Feature: Index
#### [MODIFY] [src/features/index/execute.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/improve-index-commands/src/features/index/execute.ts)
- Export `clearIndex()`: Calls `store.clear()`.
- Export `getIndexStats()`: Calls `store.stats()`.
- Export `rebuildIndex()`: Calls `clearIndex()` then `indexRepo()`.
- Ensure `indexFile` is exported and reusable.

#### [MODIFY] [src/features/index/cli.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/improve-index-commands/src/features/index/cli.ts)
- Update `indexHelp` to include new subcommands.
- parsing logic to handle:
    - `nooa index file <path>`
    - `nooa index clear`
    - `nooa index stats`
    - `nooa index rebuild`

### Documentation
#### [MODIFY] [docs/commands/index.md](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/improve-index-commands/docs/commands/index.md)
- Document the new subcommands and their usage.

## Verification Plan

### Automated Tests
Run `bun test` to execute the following new tests:

1.  **[NEW] `src/core/db/index.test.ts`**:
    - Test `store.storeEmbedding`, then `store.stats` returns correct count.
    - Test `store.clear` removes all embeddings.

2.  **[NEW] `src/features/index/index.test.ts`**:
    - Test `indexFile` calls `store.storeEmbedding`.
    - Test `clearIndex` calls `store.clear`.
    - Test `rebuildIndex` sequence.

### Manual Verification
1.  Run `nooa index file src/features/index/cli.ts` -> Verify success message.
2.  Run `nooa index stats` -> Verify output shows JSON/text stats.
3.  Run `nooa index clear` -> Verify stats show 0.
