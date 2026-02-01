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

## How it works

The command manages the `.nooa-ignore` file at the repository root. This file is honored by the `PolicyEngine` during `nooa check`.

## Examples

```bash
nooa ignore add "legacy/*.js"
nooa ignore list
nooa ignore remove "src/temp.ts"
```
