# nooa pr

Manage GitHub Pull Requests directly from the terminal. This command integrates with the GitHub REST API to streamline your workflow without switching to a browser.

## Usage

```bash
nooa pr <subcommand> [flags]
```

## Subcommands

- `create --title <t> --body <b>`: Create a new PR from the current branch.
- `list`: List all open PRs for the current repository.
- `review <number>`: Fetch a PR's diff and perform an AI-powered code review locally.

## Flags

- `--repo <owner/repo>`: Manually specify the repository. Otherwise, it's inferred from git remotes.
- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## How it works

1. **Auth**: Uses the `GITHUB_TOKEN` environment variable for authentication.
2. **Inference**: Automatically detects the repository owner and name from the `origin` remote.
3. **API Call**: Executes the requested action via the GitHub REST API.
4. **Review (optional)**: For `pr review`, it fetches the raw diff and pipes it through NOOA's internal review engine.

## Examples

```bash
# List all PRs
nooa pr list

# Create a PR
nooa pr create --title "feat: added github integration" --body "Integrated GitHub API"

# Review a specific PR
nooa pr review 42 --json
```
