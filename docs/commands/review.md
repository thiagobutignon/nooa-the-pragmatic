# Review Command

The `review` command performs an AI-powered code review of a specific file or the current staged changes.

## Usage

```bash
nooa review [path] [flags]
```

### Arguments

- **`[path]`**: Optional path to a file. If omitted, the command reviews staged changes (`git diff --cached`).

### Flags

- **`--prompt <name>`**: Use a specific prompt template (default: `review`).
- **`--json`**: Output structured findings as JSON. This is ideal for CI/CD pipelines or automated workflows.
- **`--out <file>`**: Save the review output (JSON or Markdown) to a specific file.
- **`--fail-on <level>`**: Exit with code 1 if findings with severity >= level are found. Levels: `low`, `medium`, `high`.
- **`-h, --help`**: Show help message.

## Exit Codes

- **`0`**: Review completed successfully with no gate violations.
- **`1`**: Execution failure (AI error, git failure) or gate triggered by severity.
- **`2`**: Validation error (invalid path, missing input, invalid flags).

## Output Schema (JSON)

When using `--json`, the command returns:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "summary": "...",
  "findings": [
    {
      "severity": "high",
      "file": "src/index.ts",
      "line": 42,
      "category": "bug",
      "message": "...",
      "suggestion": "..."
    }
  ],
  "stats": {
    "files": 1,
    "findings": 5
  }
}
```

## Examples

```bash
nooa review src/core/engine.ts
nooa review --json --fail-on high
nooa review --prompt agent
```
