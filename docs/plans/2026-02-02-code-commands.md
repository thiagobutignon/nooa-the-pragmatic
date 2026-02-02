# Feature: Code Commands Improvements

Implement `diff`, `format`, and `refactor` subcommands for `nooa code`.

## Proposed Changes

### Feature: Code
#### [MODIFY] [src/features/code/cli.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/code-commands/src/features/code/cli.ts)
- Add subcommands `diff`, `format`, `refactor`.
- Implement CLI parsing logic.

#### [NEW] [src/features/code/diff.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/code-commands/src/features/code/diff.ts)
- `executeDiff(path)`: Wraps `git diff` or similar logic?
- Or checks specific file diffs.
- *Assumption*: "diff" typically means `git diff` but restricted or formatted. Or maybe diff against a reference?
- *Ref*: User request just says "diff". I'll assume standard git diff wrapper or file comparison.

#### [NEW] [src/features/code/format.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/code-commands/src/features/code/format.ts)
- `executeFormat(path)`: Wraps `biome format` or `prettier`.
- Project uses `biome`. So I'll wrap `biome format`.

#### [NEW] [src/features/code/refactor.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/code-commands/src/features/code/refactor.ts)
- `executeRefactor(path, instructions)`:
    - Uses AI to refactor code based on instructions.
    - Input: file path, prompt.
    - Process: Read file -> Prompt AI -> Apply patch/rewrite.

### Documentation
#### [MODIFY] [docs/commands/index.md](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/code-commands/docs/commands/code.md)
- NOTE: User said `docs/commands/code`. Assuming `docs/commands/code.md` exists or create it.

## Verification Plan

### Automated Tests
Run `bun test` to execute new tests:
- `src/features/code/diff.test.ts`
- `src/features/code/format.test.ts`
- `src/features/code/refactor.test.ts`

### Manual Verification
- `nooa code diff`: Check output matches git diff.
- `nooa code format src/foo.ts`: Check formatting applied.
- `nooa code refactor src/foo.ts "rename var x to y"`: Check AI refactor.
