# CLI Dogfooding Bug Report (2026-01-30)

## 1. Legacy Help Text in Root Command
- **Status**: Fixed in `dogfooding-v1`
- **Description**: The `nooa --help` output still listed `resume`, `bridge`, and `jobs` subcommands even though the feature directories were pruned.
- **Root Cause**: The help text in `index.ts` was hardcoded and not updated during the pruning process.

## 2. Subcommand `patch` Ignored
- **Status**: Fixed in `dogfooding-v1` (via alias)
- **Description**: Running `nooa code patch <path>` printed the help text instead of applying a patch. Only `nooa code write <path> --patch` was functional.
- **Root Cause**: The `code` command handler was strictly matching `action === 'write'`.
