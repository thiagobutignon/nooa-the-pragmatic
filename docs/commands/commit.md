# nooa commit

Commit staged changes with validation. This command ensures that your codebase remains healthy by running tests and checking for forbidden markers (like `TODO` or `MOCK`) before completing the commit.

## Usage

```bash
nooa commit -m <message> [flags]
```

## Flags

- `-m <message>` - Commit message (required)
- `--no-test` - Skip automatic test verification (useful for docs-only changes)
- `--allow-todo` - Allow `TODO` or `MOCK` markers in the committed files
- `-h, --help` - Show help message

## Examples

### Standard commit
```bash
nooa commit -m "feat: implement user authentication"
```

### Doc-only commit (skipping tests)
```bash
nooa commit -m "docs: update api reference" --no-test
```

### Commit with TODOs
```bash
nooa commit -m "feat: layout draft" --allow-todo
```

## Exit Codes

- `0` - Success
- `1` - Runtime Error (git failure or test execution failed)
- `2` - Validation Error (missing message or local guards failed, e.g., forbidden markers found)

## Guards & Validation

The `commit` command performs several checks:
1.  **Git Repository**: Ensures the current directory is a git repository.
2.  **Staged Changes**: Verifies there are staged changes to commit.
3.  **Forbidden Markers**: Scans for `TODO`, `MOCK`, and other placeholders (unless `--allow-todo` is used).
4.  **Tests**: Runs `bun test` to ensure no regressions (unless `--no-test` is used).

## Troubleshooting

### "Forbidden markers found"
The commit was blocked because placeholders like `TODO` were found in the code. Finish the task or use `--allow-todo` if you explicitly want to commit them.

### "Tests failed"
Your changes introduced a regression. Fix the tests before committing, or use `--no-test` if you are sure they are unrelated to your current commit.
