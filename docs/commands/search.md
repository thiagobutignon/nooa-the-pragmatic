# nooa search

Search files and file contents with structured output.

## Usage

```bash
nooa search <query> [path] [flags]
```

## Arguments

- `<query>` - Search term or regex pattern (use `--regex` to enable regex mode)
- `[path]` - Directory to search in (default: `.`)

## Flags

- `--regex` - Treat query as a regular expression
- `--case-sensitive` - Enable case-sensitive matching
- `--ignore-case, -i` - Enable case-insensitive matching
- `--files-only` - Only list matching file paths
- `--count, -c` - Show only the count of matches per file
- `--max-results <n>` - Limit total matches (default: `100`)
- `--include <glob>` - Include files matching glob (repeatable)
- `--exclude <glob>` - Exclude files matching glob (repeatable)
- `--context <n>` - Show `n` lines of context (default: `0`)
- `--hidden` - Include hidden files and directories
- `--json` - Output detailed results as JSON
- `--plain` - Output results in a stable, parseable format
- `--no-color` - Disable terminal colors in output
- `-h, --help` - Show help message

## Exit Codes

- `0` - Success (matches found)
- `1` - Runtime Error (failed execution)
- `2` - Validation Error (missing query)

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
