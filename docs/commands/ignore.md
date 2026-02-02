# nooa ignore

Manage exclusions for the Zero-Preguiça policy checker. This allows you to intentionally bypass checks for specific files or lines.

## Usage

```bash
nooa ignore [subcommand] [args] [flags]
```

## Subcommands

- `add <entry>`: Add a file or pattern to `.nooa-ignore`.
- `remove <entry>`: Remove a file or pattern from `.nooa-ignore`.
- `list`: List all currently ignored patterns.
- `check <path>`: Check whether a specific path is currently ignored.
- `test <pattern> [paths...]`: Test a glob pattern against local paths without mutating `.nooa-ignore`.

## How it works

The command manages the `.nooa-ignore` file at the repository root. This file is honored by the `PolicyEngine` during `nooa check`.

Evaluation history (`.nooa/eval-history.json`) is automatically written by the `nooa eval` workflow, so add that file here if you want those records skipped by policy audits.

## Examples

```bash
nooa ignore add "legacy/*.js"
nooa ignore list
nooa ignore check "legacy/old.ts"
nooa ignore test "legacy/*.js" "legacy/old.ts" "src/index.ts"
nooa ignore add ".nooa/eval-history.json"
nooa ignore remove "legacy/*.js"
```
