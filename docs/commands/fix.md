# nooa fix

Autonomous agent loop for bug fixing and feature implementation. It orchestrates multiple NOOA commands to provide a "hands-off" development experience.

## Usage

```bash
nooa fix <issue_description> [flags]
```

## Arguments

- `<issue_description>`: A natural language description of what needs to be fixed or implemented.

## Flags

- `--dry-run`: Performs analysis and orchestration but skips actual changes (useful for verification).
- `--json`: Output current progress and results as a JSON object.
- `-h, --help`: Show help message.

## The Autonomous Loop

1. **Worktree**: Creates a new Git worktree and branch for the issue to ensure isolation.
2. **Context**: Uses **Semantic Search** (`nooa ask`) to find relevant code snippets across the repository.
3. **Patch**: Generates and applies a code patch based on the context (AI integration).
4. **Verify**: Runs the **CI Pipeline** (`nooa ci`) to ensure the fix doesn't break existing tests or policies.
5. **Commit**: Commits the changes with a proper message if all tests pass.

## Examples

```bash
# Start a fix for a specific bug
nooa fix "fix null pointer in logger"

# Analyze a feature request without applying it
nooa fix "implement user profiles" --dry-run
```

---

> [!IMPORTANT]
> The `fix` command relies on a previously generated index. Run `nooa index repo` before using `fix` for best results.
