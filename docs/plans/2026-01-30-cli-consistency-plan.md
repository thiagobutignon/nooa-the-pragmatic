# CLI Consistency & UX Improvements Implementation Plan

**Goal:** Standardize the CLI experience across all subcommands by aligning help text formatting, documenting exit codes, and improving subcommand discovery in the root help.

## Proposed Changes

### 1. Root Help: Alphabetical Sorting
- **File**: `src/core/registry.ts`
- **Change**: Refactor `CommandRegistry.list()` to return registered commands sorted alphabetically by `name`. This ensures a predictable order in the `nooa --help` output.

### 2. Subcommand Help: Standardized Formatting
Update `cli.ts` for all features (`read`, `code`, `search`, `message`, `worktree`, `commit`) to use a unified structure:
- **Usage Line**: Consistent `Usage: nooa <subcommand> <args> [flags]` format.
- **Section Headers**: Use `Arguments:`, `Flags:`, `Examples:`, and `Exit Codes:`.
- **Alignment**: Ensure descriptions and flags are neatly aligned.

### 3. Exit Codes Documentation
Add a new **Exit Codes** section to each subcommand's help string:
- `0`: Success
- `1`: Runtime Error (failed execution)
- `2`: Validation Error (invalid arguments/flags)

---

## Verification Plan

### Automated Tests
- Run `bun test` to ensure no regressions.

### Manual Verification
- **Root Help**: Run `nooa --help` and verify alphabetical sorting.
- **Subcommand Consistency**: Run `nooa <cmd> --help` for all 6 commands and check:
  - Usage line accuracy.
  - Section header consistency.
  - Presence of "Exit Codes" section.
  - Clean column alignment.
