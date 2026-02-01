# nooa context

Generate a surgical context pack for AI consumption. It bundles the target file, related imports, tests, and recent git history.

## Usage

```bash
nooa context <file_path> [flags]
```

## Arguments

- `<file_path>`: Path to the file you want to generate context for.

## Flags

- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## How it works

1. **Target**: Reads the full content of the specified file.
2. **Related**: Uses a basic heuristic to find local imports and list them as related files.
3. **Tests**: Automatically looks for a `.test.ts` counterpart.
4. **Commits**: Extracts the last 5 commits related to that file using `git log`.

## Examples

```bash
# Human readable output
nooa context src/core/logger.ts

# JSON output for AI pipe
nooa context src/features/ci/execute.ts --json
```
