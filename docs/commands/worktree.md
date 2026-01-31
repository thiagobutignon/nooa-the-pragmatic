# nooa worktree

Create a git worktree for isolated feature work, with optional install + test.

## Prerequisites

- Must be inside a git repository.
- Base branch must exist locally (default: `main`).

## What is a worktree?

A worktree is an additional working directory for the same repository. It lets you work on multiple branches at once without switching your main checkout.

## Usage

```bash
nooa worktree <branch> [flags]
```

## Arguments

- `<branch>` - Name of the new branch and directory for the worktree (required)

## Flags

- `--base <branch>` - Base branch to branch from (default: `main`)
- `--no-install` - Skip automatic dependency installation
- `--no-test` - Skip automatic test verification
- `-h, --help` - Show help message

## Exit Codes

- `0` - Success
- `1` - Runtime Error (git failure or install/tests failed)
- `2` - Validation Error (invalid branch or not a git repo)

## Examples

```bash
# Create a worktree from main
nooa worktree feat/search

# Use a different base branch
nooa worktree feat/hotfix --base release

# Skip install + tests
nooa worktree feat/quick --no-install --no-test
```

## Common Workflows

- Create a worktree for a feature, run tests, and keep main clean
- Use `--no-test` for quick scaffolds, then run tests manually

## Remove a worktree

```bash
git worktree remove .worktrees/feat/search
```

## Troubleshooting

- **Base branch not found**: fetch or create the branch locally
- **Worktree already exists**: remove it or choose a new branch name
- **Install/test failures**: fix in the worktree and re-run
