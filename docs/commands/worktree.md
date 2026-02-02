# nooa worktree

Create a git worktree for isolated feature work, with optional install + test.

## Prerequisites

- Must be inside a git repository.
- Base branch must exist locally (default: `main`).

## What is a worktree?

A worktree is an additional working directory for the same repository. It lets you work on multiple branches at once without switching your main checkout.

## Usage

```bash
nooa worktree <subcommand> [args] [flags]
```

## Arguments

- `<branch>` - Name of the new branch and directory for the worktree (required)

## Subcommands

- `create <branch>` – Create a new worktree, install deps, and run tests (default when no subcommand provided). Use `--base`, `--no-install`, `--no-test`, `--json` as needed.
- `list` – Show existing worktrees under `.worktrees/`. Pass `--json` to get structured output useful for automation.
- `info <branch>` – Query metadata for a specific worktree; pass `--json` to consume programmatically.
- `remove <branch>` – Remove a previously created worktree directory (`git worktree remove`).
- `prune` – Run `git worktree prune` to clean stale entries without manually calling git.
- `lock <branch>` / `unlock <branch>` – Mirror `git worktree lock|unlock` so you can safely lock a feature worktree before force-pushing or release work.

## Flags

- `--base <branch>` – Base branch to branch from (default: `main`)
- `--no-install` – Skip automatic dependency installation (only applies to `create`)
- `--no-test` – Skip automatic test verification (only applies to `create`)
- `--json` – Output structured JSON (supported by `create` and `list`)
- `-h, --help` – Show help message

## Exit Codes

- `0` - Success
- `1` - Runtime Error (git failure or install/tests failed)
- `2` - Validation Error (invalid branch or not a git repo)

## Examples

```bash
# Create a worktree from main
nooa worktree create feat/search

# Use a different base branch
nooa worktree create feat/hotfix --base release

# Skip install + tests
nooa worktree create feat/quick --no-install --no-test

# List worktrees, JSON output
nooa worktree list --json

# Remove a worktree and prune stale entries
nooa worktree remove feat/search
nooa worktree prune

# Lock/unlock before force pushes
nooa worktree lock feat/hotfix
nooa worktree unlock feat/hotfix

# Inspect a managed worktree (JSON output for automation)
nooa worktree info feat/search --json
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
