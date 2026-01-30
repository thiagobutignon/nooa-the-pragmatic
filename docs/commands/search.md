# nooa search

Search files and file contents with structured output.

## Usage

```bash
nooa search <query> [path] [flags]
```

## Arguments

- `<query>`: search term or regex (use `--regex` to treat as regex)
- `[path]`: root directory (default: `.`)

## Flags

- `--regex` treat query as regex
- `--case-sensitive` disable case-insensitive search
- `--ignore-case`, `-i` enable case-insensitive search
- `--files-only` list matching files only (no content matches)
- `--count`, `-c` show only count of matches per file
- `--max-results <n>` limit results (default: 100)
- `--include <glob>` include glob (repeatable)
- `--exclude <glob>` exclude glob (repeatable)
- `--context <n>` show n lines of context around matches (default: 0)
- `--hidden` include hidden files
- `--json` output structured JSON
- `--plain` output stable line format (`path:line:column:snippet`)
- `--no-color` disable color output
- `-h, --help` show help

## Output

- **stdout**: results only (plain or JSON)
- **stderr**: diagnostics and summary

## Exit Codes

- `0` success (matches or no matches)
- `1` runtime error
- `2` invalid usage

## Environment

- `NOOA_SEARCH_ENGINE`: force engine (`rg` or `native`)
- `NOOA_SEARCH_MAX_RESULTS`: override default max results

## Examples

```bash
# Basic search
nooa search "TODO"

# Regex search
nooa search "\\bfunction\\s+\\w+" --regex

# JSON output for scripting
nooa search "error" --json | jq '.[] | .path'

# Search specific file types
nooa search "import" --include "*.ts" --exclude "*.test.ts"

# Files only
nooa search "TODO" --files-only

# Count matches per file
nooa search "TODO" --count
```

## Performance Tips

- If `rg` (ripgrep) is installed, it will be used automatically for speed.
- For small projects or when `rg` is unavailable, the native engine is used.
- Use `--max-results` to cap output for large repositories.

## Troubleshooting

- **No results when you expect matches**: try `--ignore-case` or `--regex`.
- **Too many matches**: add `--include` or `--exclude`, or lower `--max-results`.
- **Runtime error**: re-run with a smaller scope or check permissions. Errors include a trace ID for debugging.
