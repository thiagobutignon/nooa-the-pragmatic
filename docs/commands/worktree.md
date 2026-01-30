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

- `<branch>`: new or existing branch name for the worktree

## Flags

- `--base <branch>` base branch (default: `main`)
- `--no-install` skip dependency install
- `--no-test` skip tests
- `-h, --help` show help

## Environment

- `NOOA_SKIP_INSTALL=1` skip dependency install
- `NOOA_SKIP_TEST=1` skip tests

## Output

- **stdout**: empty on success (stderr used for summary)
- **stderr**: summary + errors

## Exit Codes

- `0` success
- `1` worktree created but install/tests failed
- `2` invalid usage or preflight failure

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
