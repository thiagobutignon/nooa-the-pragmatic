# nooa pr

Manage GitHub Pull Requests directly from the terminal. This command uses the GitHub CLI (`gh`) to streamline your workflow without switching to a browser.

## Usage

```bash
nooa pr <subcommand> [flags]
```

## Subcommands

- `create --title <t> --body <b>`: Create a new PR from the current branch.
- `list`: List all open PRs for the current repository.
- `review <number>`: Fetch a PR's diff and perform an AI-powered code review locally.
- `merge <number> --method <merge|squash|rebase>`: Merge a PR using the selected method.
- `close <number>`: Close a PR without merging.
- `comment <number> --body <md>`: Add a markdown comment to a PR (stdin supported).
- `status <number>`: Show checks, labels, and approvals for a PR.

## Flags

- `--repo <owner/repo>`: Manually specify the repository. Otherwise, it's inferred from git remotes.
- `--method <merge|squash|rebase>`: Merge method for `pr merge` (default: merge).
- `--title <t>`: Merge commit title (merge method only).
- `--message <m>`: Merge commit message (merge method only).
- `--body <md>`: Comment body in markdown (or stdin if omitted).
- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## How it works

1. **Auth**: Uses `gh auth login` for authentication.
2. **Repository**: Uses `gh`'s current context (repo/owner inferred by `gh`).
3. **API Call**: Executes the requested action via `gh` commands.
4. **Review (optional)**: For `pr review`, it fetches the raw diff and pipes it through NOOA's internal review engine.

## Examples

```bash
# List all PRs
nooa pr list

# Create a PR
nooa pr create --title "feat: added github integration" --body "Integrated GitHub API"

# Review a specific PR
nooa pr review 42 --json

# Merge a PR with squash
nooa pr merge 42 --method squash

# Close a PR
nooa pr close 42

# Comment on a PR with markdown
nooa pr comment 42 --body "**LGTM** — ship it"

# Show status (checks/labels/approvals)
nooa pr status 42 --json
```
