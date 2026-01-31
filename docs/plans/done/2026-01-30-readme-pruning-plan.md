# README.md Cleanup Implementation Plan

**Goal:** Remove references to legacy or removed features (`bridge`, `jobs`, `resume`) from `README.md` to ensure the documentation accurately reflects the current state of the repository.

## User Review Required

> [!IMPORTANT]
> This change strictly removes documentation for features that are no longer present in `src/features/`.

## Proposed Changes

### Documentation (README.md)
Remove specific lines from the Project Structure diagram and any other mentions of:
- `bridge`
- `jobs`
- `resume`

Also, ensure the current active features are listed in the diagram:
- `chat`
- `code`
- `commit`
- `push`
- `read`
- `search`
- `worktree`

---

## Verification Plan

### Manual Verification
- **Doc Review**: Verify `README.md` looks clean and accurate.
- **Link Check**: Ensure no links were broken (though these features didn't have dedicated doc links in the diagram).
