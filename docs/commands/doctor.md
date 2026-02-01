# nooa doctor

Check the health of your development environment. It ensures all required system binaries are available and up to date.

## Usage

```bash
nooa doctor [flags]
```

## Flags

- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## Checked Tools

- **bun**: Required for running the CLI and tests.
- **git**: Required for worktrees, commits, and context extraction.
- **ripgrep (rg)**: Required for high-performance searching.
- **sqlite3**: Required for persistent memory and embeddings.

## Exit Codes

- `0`: All checks passed.
- `1`: One or more tools are missing or failed.

## Examples

```bash
nooa doctor
nooa doctor --json
```
